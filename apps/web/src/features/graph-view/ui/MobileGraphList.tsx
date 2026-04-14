"use client";

import { useState } from "react";
import type { TopicPagePayload, TopicPageNode } from "@mathgraph/shared";

const SLOT_LABELS: Record<string, string> = {
  CORE:    "Основные понятия",
  METHODS: "Методы",
  SKILLS:  "Навыки",
  TASKS:   "Задачи",
};

const ROLE_LABELS: Record<string, string> = {
  TOPIC:   "Тема",
  CONCEPT: "Понятие",
  METHOD:  "Метод",
  SKILL:   "Навык",
  TASK:    "Задача",
};

type Props = {
  payload: TopicPagePayload;
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
};

export function MobileGraphList({ payload, selectedNodeId, onSelectNode }: Props) {
  const [expandedSlot, setExpandedSlot] = useState<string | null>("CORE");
  const nodeById = new Map(payload.nodes.map((n) => [n.id, n]));
  const externals = payload.nodes.filter((n) => n.isExternal && n.role === "TOPIC");
  const topicNode = payload.nodes.find((n) => n.id === payload.topicId);

  return (
    <div className="overflow-y-auto h-full pb-4" style={{ WebkitOverflowScrolling: "touch" }}>
      {/* ── Hero topic card ── */}
      {topicNode && (
        <div
          className="mx-3 mt-3 rounded-2xl p-4"
          style={{
            background: "var(--bg-card)",
            border: "2px solid var(--accent)",
            boxShadow: "0 4px 20px var(--accent-glow)",
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
              style={{
                background: "linear-gradient(135deg, var(--accent), var(--accent-hover))",
                color: "#fff",
              }}
            >
              {topicNode.title[0]}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold leading-snug" style={{ color: "var(--text-primary)" }}>
                {topicNode.title}
              </div>
              {topicNode.description && (
                <div className="text-xs mt-1 line-clamp-2" style={{ color: "var(--text-secondary)" }}>
                  {topicNode.description}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Prerequisites ── */}
      {externals.length > 0 && (
        <div className="mx-3 mt-3">
          <SectionLabel>Пререквизиты</SectionLabel>
          <div className="space-y-2 mt-2">
            {externals.map((n) => (
              <NodeCard
                key={n.id}
                node={n}
                isSelected={n.id === selectedNodeId}
                onSelect={() => onSelectNode(n.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Slots ── */}
      <div className="mx-3 mt-3 space-y-2">
        {payload.slots.map((slot) => {
          const isVisible = slot.state === "visible";
          const isExpanded = expandedSlot === slot.kind;
          const slotNodes = isVisible
            ? (slot.orderedNodeIds.map((id) => nodeById.get(id)).filter(Boolean) as TopicPageNode[])
            : [];

          return (
            <div key={slot.kind} className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              <button
                onClick={() => setExpandedSlot(isExpanded ? null : slot.kind)}
                className="w-full flex items-center justify-between px-4 py-3.5 transition-colors"
                style={{
                  background: isExpanded ? "var(--accent-subtle)" : "var(--bg-card)",
                  color: isVisible ? "var(--text-primary)" : "var(--text-muted)",
                }}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: isExpanded ? "var(--accent)" : isVisible ? "var(--text-muted)" : "var(--border)" }}
                  />
                  <span className="text-sm font-semibold">{SLOT_LABELS[slot.kind] ?? slot.kind}</span>
                </div>
                <div className="flex items-center gap-2">
                  {isVisible ? (
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ background: isExpanded ? "var(--accent)" : "var(--bg-input)", color: isExpanded ? "#fff" : "var(--text-muted)" }}
                    >
                      {slotNodes.length}
                    </span>
                  ) : (
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>depth {slot.minDepthToExpand}+</span>
                  )}
                  <span
                    className="text-xs"
                    style={{
                      color: "var(--text-muted)",
                      transform: isExpanded ? "rotate(180deg)" : "none",
                      transition: "transform 0.2s",
                      display: "inline-block",
                    }}
                  >
                    ▾
                  </span>
                </div>
              </button>

              {isExpanded && isVisible && slotNodes.length > 0 && (
                <div
                  className="divide-y animate-fade-in"
                  style={{ borderTop: "1px solid var(--border)", divideColor: "var(--border)" } as React.CSSProperties}
                >
                  {slotNodes.map((n) => (
                    <NodeCard
                      key={n.id}
                      node={n}
                      isSelected={n.id === selectedNodeId}
                      onSelect={() => onSelectNode(n.id)}
                      flat
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-wider px-1" style={{ color: "var(--text-muted)" }}>
      {children}
    </div>
  );
}

function NodeCard({
  node,
  isSelected,
  onSelect,
  flat = false,
}: {
  node: TopicPageNode;
  isSelected: boolean;
  onSelect: () => void;
  flat?: boolean;
}) {
  const roleColor = `var(--role-${node.role.toLowerCase()})`;
  const roleBg = `var(--role-${node.role.toLowerCase()}-bg)`;

  return (
    <button
      onClick={onSelect}
      className="w-full text-left flex items-center gap-3 transition-colors active:scale-[0.98]"
      style={{
        padding: flat ? "12px 16px" : "14px",
        background: isSelected ? "var(--accent-subtle)" : flat ? "var(--bg-card)" : "var(--bg-card)",
        borderRadius: flat ? 0 : 16,
        border: flat ? "none" : `1.5px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
      }}
    >
      {/* Role color dot */}
      <div
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ background: roleColor, boxShadow: isSelected ? `0 0 6px ${roleColor}` : "none" }}
      />

      <div className="flex-1 min-w-0">
        <div
          className="text-sm font-medium leading-snug"
          style={{ color: isSelected ? "var(--accent)" : "var(--text-primary)" }}
        >
          {node.title}
        </div>
        {node.description && (
          <div className="text-xs mt-0.5 line-clamp-1" style={{ color: "var(--text-muted)" }}>
            {node.description}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span
          className="text-[10px] px-1.5 py-0.5 rounded-md"
          style={{ background: roleBg, color: roleColor }}
        >
          {ROLE_LABELS[node.role]}
        </span>
        <span style={{ color: "var(--text-muted)", fontSize: 12 }}>›</span>
      </div>
    </button>
  );
}
