import { type Edge, type Node } from "reactflow";
import { type RoadmapPayload, type RoadmapNode } from "@/lib/roadmapApi";

export type RoadmapNodeData = {
  title: string;
  role: "TOPIC" | "CONCEPT" | "METHOD" | "SKILL" | "TASK";
  parentTopicId: string | null;
  childCount: number;
  isExpanded: boolean;
};

const ROLE_ORDER: Record<string, number> = {
  TOPIC: 0,
  CONCEPT: 1,
  METHOD: 2,
  SKILL: 3,
  TASK: 4,
};

/**
 * Builds a hierarchical graph layout for the roadmap.
 *
 * At depth=0 it's just topics in a DAG layout.
 * At depth>0, children are placed in rows below their parent topic.
 */
export function buildRoadmapGraph(params: {
  payload: RoadmapPayload;
  expandedTopics: Set<string>;
}): { nodes: Node<RoadmapNodeData>[]; edges: Edge[] } {
  const { payload, expandedTopics } = params;

  const topics = payload.nodes.filter((n) => n.role === "TOPIC");
  const childrenByTopic = new Map<string, RoadmapNode[]>();

  for (const n of payload.nodes) {
    if (n.role !== "TOPIC" && n.parentTopicId) {
      const list = childrenByTopic.get(n.parentTopicId) ?? [];
      list.push(n);
      childrenByTopic.set(n.parentTopicId, list);
    }
  }

  // Sort children by role order
  for (const [, children] of childrenByTopic) {
    children.sort((a, b) => (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9));
  }

  // ── Topological layout for topics ──
  // Build adjacency for topic-level PREREQ edges
  const topicPrereqEdges = payload.edges.filter(
    (e) => e.kind === "PREREQ_REQUIRED" &&
      topics.some((t) => t.id === e.from) &&
      topics.some((t) => t.id === e.to),
  );

  // Assign layers via longest-path layering (topological)
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const t of topics) {
    inDegree.set(t.id, 0);
    adj.set(t.id, []);
  }
  for (const e of topicPrereqEdges) {
    inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1);
    adj.get(e.from)?.push(e.to);
  }

  // BFS layer assignment
  const layer = new Map<string, number>();
  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) {
      queue.push(id);
      layer.set(id, 0);
    }
  }

  // Longest-path: use forward propagation
  let idx = 0;
  while (idx < queue.length) {
    const cur = queue[idx++];
    const curLayer = layer.get(cur)!;
    for (const next of adj.get(cur) ?? []) {
      const newLayer = curLayer + 1;
      if ((layer.get(next) ?? -1) < newLayer) {
        layer.set(next, newLayer);
      }
      const newIn = (inDegree.get(next) ?? 1) - 1;
      inDegree.set(next, newIn);
      if (newIn === 0) queue.push(next);
    }
  }

  // Handle isolated topics (no edges)
  for (const t of topics) {
    if (!layer.has(t.id)) layer.set(t.id, 0);
  }

  // Group topics by layer
  const topicsByLayer = new Map<number, RoadmapNode[]>();
  for (const t of topics) {
    const l = layer.get(t.id) ?? 0;
    const list = topicsByLayer.get(l) ?? [];
    list.push(t);
    topicsByLayer.set(l, list);
  }

  // ── Position calculation ──
  const TOPIC_WIDTH = 240;
  const CHILD_WIDTH = 180;
  const CHILD_HEIGHT = 60;
  const X_GAP = 60;
  const CHILD_X_GAP = 24;
  const Y_LAYER_GAP = 180;
  const Y_CHILD_GAP = CHILD_HEIGHT + 30; // child row spacing = height + gap
  const Y_CHILD_START = 90;

  const nodes: Node<RoadmapNodeData>[] = [];
  const topicPositions = new Map<string, { x: number; y: number }>();

  // Calculate total vertical space per topic (including children if expanded)
  const topicHeight = (topicId: string): number => {
    const BASE = 60;
    if (!expandedTopics.has(topicId)) return BASE;
    const children = childrenByTopic.get(topicId) ?? [];
    if (children.length === 0) return BASE;
    // Group children by role
    const roleGroups = new Map<string, RoadmapNode[]>();
    for (const c of children) {
      const list = roleGroups.get(c.role) ?? [];
      list.push(c);
      roleGroups.set(c.role, list);
    }
    const numRoleRows = roleGroups.size;
    return BASE + Y_CHILD_START + numRoleRows * Y_CHILD_GAP;
  };

  // Position topics layer by layer
  let currentY = 40;
  const sortedLayers = Array.from(topicsByLayer.keys()).sort((a, b) => a - b);

  for (const l of sortedLayers) {
    const layerTopics = topicsByLayer.get(l)!;
    // Calculate effective width per topic (wider if expanded children exceed topic width)
    const effectiveWidths = layerTopics.map((t) => {
      if (!expandedTopics.has(t.id)) return TOPIC_WIDTH;
      const children = childrenByTopic.get(t.id) ?? [];
      if (children.length === 0) return TOPIC_WIDTH;
      // Find widest role group
      const roleGroups = new Map<string, number>();
      for (const c of children) roleGroups.set(c.role, (roleGroups.get(c.role) ?? 0) + 1);
      let maxGroupWidth = 0;
      for (const [, count] of roleGroups) {
        maxGroupWidth = Math.max(maxGroupWidth, count * CHILD_WIDTH + (count - 1) * CHILD_X_GAP);
      }
      return Math.max(TOPIC_WIDTH, maxGroupWidth);
    });
    const totalWidth = effectiveWidths.reduce((s, w) => s + w, 0) + (layerTopics.length - 1) * X_GAP;
    const startX = Math.max(40, (1400 - totalWidth) / 2);

    let maxLayerHeight = 0;

    // Calculate cumulative X offsets based on effective widths
    const xOffsets: number[] = [];
    let accX = startX;
    for (let i = 0; i < layerTopics.length; i++) {
      xOffsets.push(accX + (effectiveWidths[i] - TOPIC_WIDTH) / 2); // center topic within effective width
      accX += effectiveWidths[i] + X_GAP;
    }

    layerTopics.forEach((t, i) => {
      const x = xOffsets[i];
      topicPositions.set(t.id, { x, y: currentY });

      const childCount = (childrenByTopic.get(t.id) ?? []).length;
      const isExpanded = expandedTopics.has(t.id);

      nodes.push({
        id: t.id,
        type: "roadmapTopic",
        position: { x, y: currentY },
        data: {
          title: t.title,
          role: "TOPIC",
          parentTopicId: null,
          childCount,
          isExpanded,
        },
      });

      // Place children if expanded
      if (isExpanded) {
        const children = childrenByTopic.get(t.id) ?? [];
        const roleGroups = new Map<string, RoadmapNode[]>();
        for (const c of children) {
          const list = roleGroups.get(c.role) ?? [];
          list.push(c);
          roleGroups.set(c.role, list);
        }

        const sortedRoles = Array.from(roleGroups.keys()).sort(
          (a, b) => (ROLE_ORDER[a] ?? 9) - (ROLE_ORDER[b] ?? 9),
        );

        let childY = currentY + Y_CHILD_START;
        for (const role of sortedRoles) {
          const group = roleGroups.get(role)!;
          const groupWidth = group.length * CHILD_WIDTH + (group.length - 1) * CHILD_X_GAP;
          // Center children under the topic, but allow overflow for wide groups
          const groupStartX = x + (TOPIC_WIDTH - groupWidth) / 2;

          group.forEach((c, ci) => {
            nodes.push({
              id: c.id,
              type: "roadmapChild",
              position: { x: groupStartX + ci * (CHILD_WIDTH + CHILD_X_GAP), y: childY },
              data: {
                title: c.title,
                role: c.role as any,
                parentTopicId: c.parentTopicId,
                childCount: 0,
                isExpanded: false,
              },
            });
          });

          childY += Y_CHILD_GAP;
        }
      }

      maxLayerHeight = Math.max(maxLayerHeight, topicHeight(t.id));
    });

    currentY += maxLayerHeight + Y_LAYER_GAP;
  }

  // ── Edges ──
  const nodeIdSet = new Set(nodes.map((n) => n.id));
  const edges: Edge[] = payload.edges
    .filter((e) => nodeIdSet.has(e.from) && nodeIdSet.has(e.to))
    .filter((e) => e.kind === "PREREQ_REQUIRED") // only show prereq arrows
    .map((e) => ({
      id: `${e.from}->${e.to}`,
      source: e.from,
      target: e.to,
      type: "smoothstep",
    }));

  return { nodes, edges };
}
