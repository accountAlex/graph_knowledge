"use client";

import { useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Edge,
  type Node,
  type NodeTypes,
  Handle,
  Position,
  MarkerType,
  BackgroundVariant,
} from "reactflow";
import { useAnimatedNodes } from "../hooks/useAnimatedNodes";

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
};

const PREREQ_COLOR = "#f59e0b";
const PREREQ_GLOW  = "rgba(245,158,11,0.35)";

function KgNode({ data }: { data: KgNodeData }) {
  const roleColor = `var(--role-${data.role.toLowerCase()})`;
  const roleBg = `var(--role-${data.role.toLowerCase()}-bg)`;
  const isHero = data.isCurrentTopic;
  const isActive = isHero || data.isSelected;
  const isPrereq = data.isPrereq && !isActive;

  const borderStyle = isActive
    ? `2px solid var(--accent)`
    : isPrereq
    ? `2px solid ${PREREQ_COLOR}`
    : data.isExternal
    ? `1px dashed var(--border)`
    : `1px solid var(--border)`;

  const shadowStyle = isActive
    ? "0 6px 24px var(--accent-glow)"
    : isPrereq
    ? `0 4px 20px ${PREREQ_GLOW}`
    : "0 2px 12px var(--shadow-color)";

  return (
    <div
      style={{
        background: isPrereq ? "rgba(245,158,11,0.06)" : "var(--bg-card)",
        border: borderStyle,
        color: "var(--text-primary)",
        opacity: data.isDimmed ? 0.12 : 1,
        width: data.width,
        boxShadow: shadowStyle,
        transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
      className="rounded-2xl px-4 py-3.5 text-center cursor-pointer hover:border-[var(--accent)] hover:-translate-y-1 hover:shadow-lg relative"
    >
      {/* Top bar */}
      <div
        className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl transition-all duration-300"
        style={{
          background: isPrereq
            ? `linear-gradient(90deg, ${PREREQ_COLOR}, #fcd34d)`
            : `linear-gradient(90deg, ${roleColor}, var(--accent))`,
          opacity: data.isDimmed ? 0.2 : isActive || isPrereq ? 1 : 0.6,
        }}
      />

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
        <span
          className="badge"
          style={{ background: roleBg, color: roleColor }}
        >
          {data.role}
        </span>
        {isPrereq && (
          <span
            className="badge text-[10px]"
            style={{ background: "rgba(245,158,11,0.15)", color: PREREQ_COLOR }}
          >
            нужен
          </span>
        )}
        {data.isExternal && !isPrereq && (
          <span style={{ color: "var(--text-muted)" }} className="text-[10px]">
            prereq
          </span>
        )}
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

const nodeTypes: NodeTypes = { kgNode: KgNode, rowLabel: RowLabelNode };

export function GraphView({ nodes: rawNodes, edges: rawEdges, selectedNodeId, onSelectNodeId }: Props) {
  const { nodes, edges } = useAnimatedNodes(rawNodes as Node<KgNodeData>[], rawEdges);

  // Stable reference — prevents React Flow HMR warning in dev
  const stableNodeTypes = useMemo(() => nodeTypes, []);

  const styledEdges = useMemo<Edge[]>(() => {
    return edges.map((e) => {
      const isActive = selectedNodeId === e.source || selectedNodeId === e.target;
      return {
        ...e,
        animated: selectedNodeId === e.source,
        style: {
          stroke: isActive ? "var(--accent)" : "var(--border)",
          strokeWidth: isActive ? 2 : 1.2,
          opacity: isActive ? 0.9 : 0.4,
          transition: "all 0.3s ease",
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isActive ? "var(--accent)" : "var(--border)",
          width: 14,
          height: 14,
        },
      };
    });
  }, [edges, selectedNodeId]);

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={styledEdges}
        nodeTypes={stableNodeTypes}
        onNodeClick={(_, n) => onSelectNodeId?.(n.id)}
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
