"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  BaseEdge,
  getSmoothStepPath,
  type Edge,
  type EdgeProps,
  type EdgeTypes,
  type Node,
  type NodeTypes,
  type ReactFlowInstance,
  Handle,
  Position,
  MarkerType,
  BackgroundVariant,
} from "reactflow";
import { useAnimatedNodes } from "../hooks/useAnimatedNodes";
import type { MasteryLevel } from "@mathgraph/shared";

export type GraphUIMode = "overview" | "focus" | "path" | "prereq";

export type KgNodeData = {
  title: string;
  role: "TOPIC" | "CONCEPT" | "METHOD" | "SKILL" | "TASK";
  isExternal: boolean;
  isCurrentTopic: boolean;
  isSelected: boolean;
  isDimmed: boolean;
  isPrereq: boolean;
  width: number;
  columnLabel?: string;
  // ── Block 1: mastery heatmap / gaps ──
  mastery?: MasteryLevel;
  completed?: boolean;
  isUnlocked?: boolean;   // all prerequisites done → newly learnable
  isGap?: boolean;        // missing prerequisite for the selected node
  heatmap?: boolean;      // heatmap mode active
  hoverDim?: boolean;     // dimmed because not in the hovered node's chain
  hoverChain?: boolean;   // part of the hovered node's prerequisite chain
};

const MASTERY_STYLE: Record<MasteryLevel, { color: string; label: string }> = {
  UNSEEN:    { color: "#64748b", label: "не начато" },
  SEEN:      { color: "#fbbf24", label: "знакомо" },
  PRACTICED: { color: "#38bdf8", label: "отработано" },
  MASTERED:  { color: "#34d399", label: "освоено" },
};

export type RowLabelData = {
  label: string;
  count: number;
};

type Props = {
  nodes: Node<KgNodeData | RowLabelData>[];
  edges: Edge[];
  selectedNodeId?: string | null;
  onSelectNodeId?: (id: string) => void;
  prereqEdges?: { from: string; to: string }[];
};

const PREREQ_COLOR = "#f59e0b";
const PREREQ_GLOW  = "rgba(245,158,11,0.35)";

function KgNode({ data }: { data: KgNodeData }) {
  const roleColor = `var(--role-${data.role.toLowerCase()})`;
  const roleBg = `var(--role-${data.role.toLowerCase()}-bg)`;
  const isHero = data.isCurrentTopic;
  const isActive = isHero || data.isSelected;
  const isPrereq = data.isPrereq && !isActive;

  const mastery = data.mastery ?? "UNSEEN";
  const m = MASTERY_STYLE[mastery];
  const isGap = !!data.isGap;
  const isUnlocked = !!data.isUnlocked && !data.completed;
  const heat = !!data.heatmap;

  // Border precedence: gap → active → unlocked → heatmap mastery → prereq → role
  const borderStyle = isGap
    ? `2px solid var(--danger)`
    : isActive
    ? `2px solid var(--accent)`
    : isUnlocked
    ? `2px solid var(--accent)`
    : heat && mastery !== "UNSEEN"
    ? `2px solid ${m.color}`
    : isPrereq
    ? `2px solid ${PREREQ_COLOR}`
    : data.isExternal
    ? `1px dashed var(--border)`
    : `1px solid var(--border)`;

  const shadowStyle = isGap
    ? "0 4px 22px rgba(255,107,107,0.40)"
    : isUnlocked
    ? "0 0 0 3px var(--accent-subtle), 0 8px 26px var(--accent-glow)"
    : isActive
    ? "0 6px 24px var(--accent-glow)"
    : heat && mastery === "MASTERED"
    ? "0 4px 20px rgba(52,211,153,0.30)"
    : isPrereq
    ? `0 4px 20px ${PREREQ_GLOW}`
    : "0 2px 12px var(--shadow-color)";

  const bgStyle = isGap
    ? "rgba(255,107,107,0.07)"
    : heat && mastery !== "UNSEEN"
    ? `${m.color}14`
    : isPrereq
    ? "rgba(245,158,11,0.06)"
    : "var(--bg-card)";

  return (
    <div
      style={{
        background: bgStyle,
        border: borderStyle,
        color: "var(--text-primary)",
        opacity: data.isDimmed || data.hoverDim ? 0.12 : 1,
        width: data.width,
        boxShadow: data.hoverChain ? `${shadowStyle}, 0 0 0 2px var(--accent)` : shadowStyle,
        transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
      className={`rounded-2xl px-4 py-3.5 text-center cursor-pointer hover:border-[var(--accent)] hover:-translate-y-1 hover:shadow-lg relative ${isUnlocked ? "animate-pulse-glow" : ""}`}
    >
      {/* Top bar */}
      <div
        className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl transition-all duration-300"
        style={{
          background: isGap
            ? "var(--danger)"
            : heat && mastery !== "UNSEEN"
            ? `linear-gradient(90deg, ${m.color}, ${m.color}88)`
            : isPrereq
            ? `linear-gradient(90deg, ${PREREQ_COLOR}, #fcd34d)`
            : `linear-gradient(90deg, ${roleColor}, var(--accent))`,
          opacity: data.isDimmed ? 0.2 : isActive || isPrereq || heat || isGap ? 1 : 0.6,
        }}
      />

      {/* Mastery corner indicator */}
      {(data.completed || mastery !== "UNSEEN") && (
        <span
          title={m.label}
          className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full ${heat && mastery === "MASTERED" ? "twinkle" : ""}`}
          style={{
            background: m.color,
            boxShadow:
              heat && mastery === "MASTERED"
                ? `0 0 8px 1px ${m.color}, 0 0 0 2px var(--bg-card)`
                : "0 0 0 2px var(--bg-card)",
          }}
        />
      )}

      <div
        className={`font-semibold leading-snug ${isHero ? "text-sm" : "text-[13px]"}`}
        style={{
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {data.title}
      </div>

      <div className="flex items-center justify-center gap-1.5 mt-2.5 flex-wrap">
        <span className="badge" style={{ background: roleBg, color: roleColor }}>
          {data.role}
        </span>
        {isGap ? (
          <span className="badge text-[10px]" style={{ background: "rgba(255,107,107,0.15)", color: "var(--danger)" }}>
            пробел
          </span>
        ) : isUnlocked ? (
          <span className="badge text-[10px]" style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}>
            доступно
          </span>
        ) : heat && mastery !== "UNSEEN" ? (
          <span className="badge text-[10px]" style={{ background: `${m.color}22`, color: m.color }}>
            {m.label}
          </span>
        ) : isPrereq ? (
          <span className="badge text-[10px]" style={{ background: "rgba(245,158,11,0.15)", color: PREREQ_COLOR }}>
            нужен
          </span>
        ) : data.isExternal ? (
          <span style={{ color: "var(--text-muted)" }} className="text-[10px]">
            prereq
          </span>
        ) : null}
      </div>

      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: isActive ? "var(--accent)" : "var(--border)",
          border: "2px solid var(--bg-card)",
          width: 8,
          height: 8,
          top: -4,
        }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: isActive ? "var(--accent)" : "var(--border)",
          border: "2px solid var(--bg-card)",
          width: 8,
          height: 8,
          bottom: -4,
        }}
      />
    </div>
  );
}

function RowLabelNode({ data }: { data: RowLabelData }) {
  return (
    <div
      className="flex items-center gap-2 pointer-events-none select-none"
      style={{ color: "var(--text-muted)" }}
    >
      <span className="text-[11px] font-semibold uppercase tracking-widest">{data.label}</span>
      <span
        className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
        style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}
      >
        {data.count}
      </span>
    </div>
  );
}

/** Edge with a particle flowing source → target (used for prerequisite links) */
function FlowEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, style }: EdgeProps) {
  const [path] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const op = typeof style?.opacity === "number" ? style.opacity : 1;
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />
      {op > 0.25 && (
        <circle r={2.4} fill="var(--accent)" opacity={Math.min(op + 0.2, 1)}>
          <animateMotion dur="2.4s" repeatCount="indefinite" path={path} />
        </circle>
      )}
    </>
  );
}

const nodeTypes: NodeTypes = { kgNode: KgNode, rowLabel: RowLabelNode };
const edgeTypes: EdgeTypes = { flow: FlowEdge };

export function GraphView({ nodes: rawNodes, edges: rawEdges, selectedNodeId, onSelectNodeId, prereqEdges }: Props) {
  const { nodes, edges } = useAnimatedNodes(rawNodes as Node<KgNodeData>[], rawEdges);

  // Stable references — prevent React Flow HMR warning in dev
  const stableNodeTypes = useMemo(() => nodeTypes, []);
  const stableEdgeTypes = useMemo(() => edgeTypes, []);

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const rfRef = useRef<ReactFlowInstance | null>(null);

  // Prerequisite chain of the hovered node: itself + all PREREQ ancestors
  const chainSet = useMemo(() => {
    if (!hoveredId || !prereqEdges || prereqEdges.length === 0) return null;
    const set = new Set<string>([hoveredId]);
    const queue = [hoveredId];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const e of prereqEdges) {
        if (e.to === cur && !set.has(e.from)) { set.add(e.from); queue.push(e.from); }
      }
    }
    return set.size > 1 ? set : null; // only engage when there is an actual chain
  }, [hoveredId, prereqEdges]);

  const displayNodes = useMemo(() => {
    if (!chainSet) return nodes;
    return nodes.map((n) => {
      if (n.type === "rowLabel") return n;
      const inChain = chainSet.has(n.id);
      return { ...n, data: { ...(n.data as KgNodeData), hoverDim: !inChain, hoverChain: inChain } };
    });
  }, [nodes, chainSet]);

  const styledEdges = useMemo<Edge[]>(() => {
    return edges.map((e) => {
      const isActive = selectedNodeId === e.source || selectedNodeId === e.target;
      const inChain = chainSet ? chainSet.has(e.source) && chainSet.has(e.target) : false;
      const dimmed = !!chainSet && !inChain;
      const highlight = isActive || inChain;
      const color = dimmed ? "var(--border)" : highlight ? "var(--accent)" : "var(--border)";
      return {
        ...e,
        animated: selectedNodeId === e.source || inChain,
        style: {
          stroke: color,
          strokeWidth: highlight ? 2 : 1.2,
          opacity: dimmed ? 0.06 : highlight ? 0.9 : 0.4,
          transition: "all 0.3s ease",
        },
        markerEnd: { type: MarkerType.ArrowClosed, color, width: 14, height: 14 },
      };
    });
  }, [edges, selectedNodeId, chainSet]);

  // Smoothly fly the camera to the selected node
  useEffect(() => {
    if (!selectedNodeId || !rfRef.current) return;
    const node = (rawNodes as Node<KgNodeData>[]).find((n) => n.id === selectedNodeId);
    if (!node || node.type === "rowLabel") return;
    const w = node.data?.width ?? 220;
    rfRef.current.setCenter(node.position.x + w / 2, node.position.y + 65, {
      zoom: rfRef.current.getZoom(),
      duration: 600,
    });
  }, [selectedNodeId, rawNodes]);

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={displayNodes}
        edges={styledEdges}
        nodeTypes={stableNodeTypes}
        edgeTypes={stableEdgeTypes}
        onInit={(inst) => { rfRef.current = inst; }}
        onNodeClick={(_, n) => onSelectNodeId?.(n.id)}
        onNodeMouseEnter={(_, n) => { if (n.type !== "rowLabel") setHoveredId(n.id); }}
        onNodeMouseLeave={() => setHoveredId(null)}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.3}
        maxZoom={2}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="var(--border-subtle)"
        />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(n) => {
            const role = n.data?.role?.toLowerCase?.() ?? "topic";
            return `var(--role-${role})`;
          }}
          maskColor="var(--accent-subtle)"
          style={{ borderRadius: 12 }}
          pannable
          zoomable
        />
      </ReactFlow>
    </div>
  );
}
