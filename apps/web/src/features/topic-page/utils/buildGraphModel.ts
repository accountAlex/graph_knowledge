import { type Edge, type Node } from "reactflow";
import { type MasteryLevel } from "@mathgraph/shared";
import { type TopicPagePayload } from "@/lib/topicPageApi";
import { type GraphUIMode, type KgNodeData, type RowLabelData } from "@/features/graph-view/ui/GraphView";

function getNeighbors(edges: { from: string; to: string }[], id: string) {
  const out = new Set<string>();
  for (const e of edges) {
    if (e.from === id) out.add(e.to);
    if (e.to === id) out.add(e.from);
  }
  return Array.from(out);
}

function shortestPath(edges: { from: string; to: string }[], from: string, to: string) {
  const q: string[] = [from];
  const prev = new Map<string, string | null>();
  prev.set(from, null);

  while (q.length) {
    const cur = q.shift()!;
    if (cur === to) break;
    for (const n of getNeighbors(edges, cur)) {
      if (!prev.has(n)) {
        prev.set(n, cur);
        q.push(n);
      }
    }
  }

  if (!prev.has(to)) return null;

  const path: string[] = [];
  let cur: string | null = to;
  while (cur) {
    path.push(cur);
    cur = prev.get(cur) ?? null;
  }
  path.reverse();
  return path;
}

// ── Vertical roadmap layout ──
// Row 0: External/prerequisite topics (upstream)
// Row 1: Current topic (the hero node)
// Row 2: CORE concepts
// Row 3: METHODS
// Row 4: SKILLS
// Row 5: TASKS

type RowId = 0 | 1 | 2 | 3 | 4 | 5;

const ROW_LABELS: Record<RowId, string> = {
  0: "Prerequisites",
  1: "Topic",
  2: "Core Concepts",
  3: "Methods",
  4: "Skills",
  5: "Tasks",
};

/** Compute adaptive node width based on title length */
function adaptiveWidth(title: string, isHero: boolean): number {
  const MIN = isHero ? 220 : 180;
  const MAX = isHero ? 320 : 280;
  // ~8.5px per char at 13px font + 32px horizontal padding
  const estimated = Math.round(title.length * 8.5 + 32);
  return Math.min(MAX, Math.max(MIN, estimated));
}

export function buildGraphModel(params: {
  payload: TopicPagePayload;
  mode: GraphUIMode;
  selectedNodeId: string | null;
  masteryByNodeId?: Map<string, MasteryLevel>;
  completedSet?: Set<string>;
  unlockedSet?: Set<string>;
  gapSet?: Set<string>;
  heatmap?: boolean;
}): { nodes: Node<KgNodeData | RowLabelData>[]; edges: Edge[] } {
  const {
    payload,
    mode,
    selectedNodeId,
    masteryByNodeId,
    completedSet,
    unlockedSet,
    gapSet,
    heatmap = false,
  } = params;

  // Build slot membership
  const slotByNodeId = new Map<string, string>();
  for (const s of payload.slots) {
    if (s.state !== "visible") continue;
    for (const id of s.orderedNodeIds) slotByNodeId.set(id, s.kind);
  }

  // Assign row
  const getRow = (nodeId: string, isExternal: boolean): RowId => {
    if (nodeId === payload.topicId) return 1;
    if (isExternal) return 0;
    const slot = slotByNodeId.get(nodeId);
    if (slot === "CORE") return 2;
    if (slot === "METHODS") return 3;
    if (slot === "SKILLS") return 4;
    if (slot === "TASKS") return 5;
    return 2; // fallback
  };

  const baseEdges = payload.edges.map((e) => ({ from: e.from, to: e.to }));

  // ── prereq ancestors BFS ──────────────────────────────────────────────────
  // For a selected node, find all nodes that are prerequisites (transitively)
  // i.e. traverse PREREQ_REQUIRED edges in reverse: edges where `to === current`
  function getPrereqAncestors(startId: string): Set<string> {
    const prereqEdges = payload.edges.filter((e) => e.kind === "PREREQ_REQUIRED");
    const visited = new Set<string>();
    const queue = [startId];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const e of prereqEdges) {
        if (e.to === cur && !visited.has(e.from)) {
          visited.add(e.from);
          queue.push(e.from);
        }
      }
    }
    return visited;
  }

  const prereqIds =
    mode === "prereq" && selectedNodeId
      ? getPrereqAncestors(selectedNodeId)
      : null;

  // Visibility filtering
  let visibleIds = payload.nodes.map((n) => n.id);

  if (mode === "focus" && selectedNodeId) {
    const oneHop = new Set<string>([selectedNodeId, ...getNeighbors(baseEdges, selectedNodeId)]);
    oneHop.add(payload.topicId);
    visibleIds = visibleIds.filter((id) => oneHop.has(id));
  }

  const pathIds =
    mode === "path" && selectedNodeId
      ? shortestPath(baseEdges, selectedNodeId, payload.topicId) ?? null
      : null;

  const visibleSet = new Set(visibleIds);

  // Group by rows
  const rowBuckets = new Map<number, string[]>();
  for (const n of payload.nodes) {
    if (!visibleSet.has(n.id)) continue;
    const row = getRow(n.id, n.isExternal);
    const list = rowBuckets.get(row) ?? [];
    list.push(n.id);
    rowBuckets.set(row, list);
  }

  // Prioritize order within rows by slot orderedNodeIds
  const orderedInRow = (row: number, ids: string[]) => {
    if (row >= 2 && row <= 5) {
      const kind = row === 2 ? "CORE" : row === 3 ? "METHODS" : row === 4 ? "SKILLS" : "TASKS";
      const slot = payload.slots.find((s) => s.kind === kind);
      if (slot && slot.state === "visible") {
        const order = slot.orderedNodeIds;
        const set = new Set(ids);
        return [...order.filter((x) => set.has(x)), ...ids.filter((x) => !order.includes(x))];
      }
    }
    return ids;
  };

  // Layout constants — vertical roadmap
  const NODE_H   = 130;   // safe height including 3-line title + badge row + padding
  const X_GAP    = 50;    // horizontal gap between nodes in same line
  const ROW_GAP  = 60;    // vertical gap between rows (added on top of NODE_H)
  const LABEL_H  = 28;    // height reserved for row-label node above each row
  const WRAP_AT  = 5;     // max nodes per line before wrapping within a row
  const VIEWPORT_W = 1200;
  const y0 = 40;

  const byId = new Map(payload.nodes.map((n) => [n.id, n]));

  // Pre-compute adaptive widths per node
  const nodeWidths = new Map<string, number>();
  for (const n of payload.nodes) {
    nodeWidths.set(n.id, adaptiveWidth(n.title, n.id === payload.topicId));
  }

  // Track cumulative Y so wrapped rows don't overlap the next logical row
  const rowStartY = new Map<number, number>();
  {
    const sortedRows = Array.from(rowBuckets.keys()).sort((a, b) => a - b);
    let curY = y0;
    for (const row of sortedRows) {
      rowStartY.set(row, curY);
      const ids = rowBuckets.get(row)!;
      const lines = Math.ceil(ids.length / WRAP_AT);
      // space = label + lines * (node + gap)
      curY += LABEL_H + lines * (NODE_H + ROW_GAP);
    }
  }

  const nodes: Node<KgNodeData | RowLabelData>[] = [];

  for (const [row, ids] of rowBuckets.entries()) {
    const sorted = orderedInRow(row, ids);
    const baseY  = rowStartY.get(row) ?? y0;
    const label  = ROW_LABELS[row as RowId] ?? "";

    // Row label node (non-interactive header)
    // Position it centered above the first line of nodes
    const firstLineCount = Math.min(sorted.length, WRAP_AT);
    const firstLineWidths = sorted.slice(0, firstLineCount).map((id) => nodeWidths.get(id) ?? 220);
    const firstLineTotalW = firstLineWidths.reduce((s, w) => s + w, 0) + (firstLineCount - 1) * X_GAP;
    const labelX = Math.max(40, (VIEWPORT_W - firstLineTotalW) / 2);

    nodes.push({
      id: `__rowlabel_${row}`,
      type: "rowLabel",
      position: { x: labelX, y: baseY },
      data: { label, count: sorted.length },
      selectable: false,
      draggable: false,
    } as Node<RowLabelData>);

    sorted.forEach((id, idx) => {
      const line = Math.floor(idx / WRAP_AT);
      const col  = idx % WRAP_AT;

      // Compute centering for this specific line
      const lineStart = line * WRAP_AT;
      const lineEnd   = Math.min(lineStart + WRAP_AT, sorted.length);
      const lineIds   = sorted.slice(lineStart, lineEnd);
      const lineTotalW = lineIds.reduce((s, lid) => s + (nodeWidths.get(lid) ?? 220), 0)
        + (lineIds.length - 1) * X_GAP;
      const startX = Math.max(40, (VIEWPORT_W - lineTotalW) / 2);

      // X offset = sum of widths of preceding nodes in this line + gaps
      const xOffset = lineIds
        .slice(0, col)
        .reduce((s, lid) => s + (nodeWidths.get(lid) ?? 220) + X_GAP, 0);

      const n = byId.get(id)!;
      const isSelected = id === selectedNodeId;
      const isCurrentTopic = id === payload.topicId;
      const isPrereq = prereqIds !== null && prereqIds.has(id);
      const isDimmed =
        (mode === "path" && pathIds ? !pathIds.includes(id) : false) ||
        (mode === "prereq" && prereqIds !== null && !isPrereq && !isSelected);
      const width = nodeWidths.get(id) ?? 220;

      nodes.push({
        id,
        type: "kgNode",
        position: {
          x: startX + xOffset,
          y: baseY + LABEL_H + line * (NODE_H + ROW_GAP),
        },
        data: {
          title: n.title,
          role: n.role,
          isExternal: n.isExternal,
          isCurrentTopic,
          isSelected,
          isDimmed,
          isPrereq,
          width,
          columnLabel: label,
          mastery: masteryByNodeId?.get(id),
          completed: completedSet?.has(id) ?? false,
          isUnlocked: unlockedSet?.has(id) ?? false,
          isGap: gapSet?.has(id) ?? false,
          heatmap,
        },
      } as Node<KgNodeData>);
    });
  }

  // Edges
  const edges: Edge[] = payload.edges
    .filter((e) => visibleSet.has(e.from) && visibleSet.has(e.to))
    .map((e) => ({
      id: `${e.from}->${e.to}:${e.kind}`,
      source: e.from,
      target: e.to,
      type: "smoothstep",
    }));

  return { nodes, edges };
}
