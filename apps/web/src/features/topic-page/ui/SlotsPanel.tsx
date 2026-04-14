"use client";

import { useMemo } from "react";
import { type TopicPagePayload, type SlotKind } from "@/lib/topicPageApi";

const SLOT_META: Record<SlotKind, { label: string; icon: string }> = {
  CORE: { label: "Основные понятия", icon: "◆" },
  METHODS: { label: "Методы", icon: "▶" },
  SKILLS: { label: "Навыки", icon: "★" },
  TASKS: { label: "Задачи", icon: "✓" },
};

export function SlotsPanel({ payload }: { payload: TopicPagePayload }) {
  const nodesById = useMemo(
    () => new Map(payload.nodes.map((n) => [n.id, n])),
    [payload.nodes],
  );

  return (
    <div className="glass-card p-4 !transform-none">
      <div
        className="text-xs font-semibold uppercase tracking-widest mb-3"
        style={{ color: "var(--text-muted)" }}
      >
        Слои знаний
      </div>

      <div className="flex flex-col gap-2">
        {payload.slots.map((s, idx) => {
          const meta = SLOT_META[s.kind];
          const isVisible = s.state === "visible";

          return (
            <div
              key={s.kind}
              className={`rounded-xl p-3 transition-all duration-300 animate-fade-in delay-${idx + 1}`}
              style={{
                background: isVisible ? "var(--bg-card-hover)" : "transparent",
                border: `1px solid ${isVisible ? "var(--border)" : "var(--border-subtle)"}`,
                opacity: isVisible ? 1 : 0.45,
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs transition-colors duration-200"
                    style={{ color: isVisible ? "var(--accent)" : "var(--text-muted)" }}
                  >
                    {meta.icon}
                  </span>
                  <span className="text-sm font-medium">{meta.label}</span>
                </div>
                <div>
                  {isVisible ? (
                    <span className="badge badge-accent">{s.totalCount}</span>
                  ) : (
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      depth &ge; {s.minDepthToExpand}
                    </span>
                  )}
                </div>
              </div>

              {isVisible && s.orderedNodeIds.length > 0 && (
                <div className="mt-2.5 flex flex-col gap-0.5">
                  {s.orderedNodeIds.map((id, nodeIdx) => {
                    const n = nodesById.get(id);
                    const roleColor = n
                      ? `var(--role-${n.role.toLowerCase()})`
                      : "var(--text-muted)";
                    return (
                      <div
                        key={id}
                        className={`flex items-center gap-2.5 text-xs py-1.5 px-2 rounded-lg transition-colors duration-200 hover:bg-[var(--bg-card)] animate-fade-in delay-${Math.min(nodeIdx + 1, 6)}`}
                      >
                        <div
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: roleColor }}
                        />
                        <span style={{ color: "var(--text-primary)" }}>
                          {n?.title ?? id}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
