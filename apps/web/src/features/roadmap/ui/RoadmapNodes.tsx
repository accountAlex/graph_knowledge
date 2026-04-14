"use client";

import { Handle, Position } from "reactflow";
import { type RoadmapNodeData } from "../utils/buildRoadmapGraph";

export function RoadmapTopicNode({ data }: { data: RoadmapNodeData }) {
  return (
    <div
      className="rounded-2xl px-5 py-4 text-center cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-xl relative"
      style={{
        background: "var(--bg-card)",
        border: "2px solid var(--role-topic)",
        width: 240,
        boxShadow: "0 4px 20px var(--shadow-color)",
      }}
    >
      {/* Top gradient bar — full width */}
      <div
        className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl"
        style={{ background: "linear-gradient(90deg, var(--role-topic), var(--accent))" }}
      />

      <div className="font-semibold text-sm leading-snug" style={{ color: "var(--text-primary)" }}>
        {data.title}
      </div>

      <div className="flex items-center justify-center gap-2 mt-2.5">
        <span
          className="badge"
          style={{ background: "var(--role-topic-bg)", color: "var(--role-topic)" }}
        >
          Topic
        </span>
        {data.childCount > 0 && (
          <span className="text-[10px] flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
            <span className="transition-transform duration-200" style={{ display: "inline-block", transform: data.isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}>
              ▸
            </span>
            {data.childCount}
          </span>
        )}
      </div>

      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: "var(--role-topic)",
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
          background: "var(--role-topic)",
          border: "2px solid var(--bg-card)",
          width: 8,
          height: 8,
          bottom: -4,
        }}
      />
    </div>
  );
}

export function RoadmapChildNode({ data }: { data: RoadmapNodeData }) {
  const roleColor = `var(--role-${data.role.toLowerCase()})`;
  const roleBg = `var(--role-${data.role.toLowerCase()}-bg)`;

  return (
    <div
      className="rounded-xl px-3.5 py-3 text-center cursor-pointer transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--accent)] relative"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        width: 180,
        boxShadow: "0 2px 10px var(--shadow-color)",
      }}
    >
      {/* Top accent bar — full width */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] rounded-t-xl"
        style={{ background: roleColor, opacity: 0.6 }}
      />

      <div className="font-medium text-xs leading-snug" style={{ color: "var(--text-primary)" }}>
        {data.title}
      </div>

      <span
        className="inline-block mt-2 badge"
        style={{ background: roleBg, color: roleColor, fontSize: 9 }}
      >
        {data.role}
      </span>

      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: roleColor,
          border: "2px solid var(--bg-card)",
          width: 6,
          height: 6,
          top: -3,
        }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: roleColor,
          border: "2px solid var(--bg-card)",
          width: 6,
          height: 6,
          bottom: -3,
        }}
      />
    </div>
  );
}
