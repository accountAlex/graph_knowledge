"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GraphView, type GraphUIMode } from "@/features/graph-view/ui/GraphView";
import { type TopicPagePayload } from "@/lib/topicPageApi";
import { SlotsPanel } from "./SlotsPanel";
import { DepthControl } from "./DepthControl";
import { buildGraphModel } from "../utils/buildGraphModel";
import { StudyPlanPanel } from "@/features/topic-page/ui/StudyPlanPanel";
import { ChatButton } from "@/features/assistant/ui/ChatButton";
import { KeyboardShortcutsHelp } from "@/features/graph-view/ui/KeyboardShortcutsHelp";
import { useGraphKeyboardNav } from "@/features/graph-view/hooks/useGraphKeyboardNav";
import { MobileGraphList } from "@/features/graph-view/ui/MobileGraphList";
import { MarkdownContent } from "@/features/graph-view/ui/MarkdownContent";
import { NodeNoteEditor } from "@/features/notes/ui/NodeNoteEditor";
import { NodeQuizPanel } from "@/features/quiz/ui/NodeQuizPanel";
import { VideoEmbed, isVideoUrl } from "@/features/graph-view/ui/VideoEmbed";
import { useMobileDetect } from "@/hooks/useMobileDetect";
import { useSwipeDown } from "@/hooks/useSwipeDown";
import { useRef } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { fetchTopicProgress, toggleNodeProgress, type TopicProgress } from "@/lib/progressApi";

type Props = {
  payload: TopicPagePayload;
  onDepthChange: (depth: number) => void;
};

const MODE_LABELS: { mode: GraphUIMode; label: string; icon: string }[] = [
  { mode: "overview", label: "Обзор",       icon: "◉" },
  { mode: "focus",    label: "Фокус",       icon: "◎" },
  { mode: "path",     label: "Путь",        icon: "⟿" },
  { mode: "prereq",   label: "Зависимости", icon: "↑" },
];

export function TopicPageLayout({ payload, onDepthChange }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const { isMobile } = useMobileDetect();
  const isAuth = !!user;
  const [mode, setMode] = useState<GraphUIMode>("overview");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [progress, setProgress] = useState<TopicProgress | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useSwipeDown(panelRef, () => setPanelOpen(false));

  // Load progress for all nodes in the topic
  const allNodeIds = useMemo(
    () => payload.nodes.filter((n) => n.id !== payload.topicId).map((n) => n.id),
    [payload.nodes, payload.topicId],
  );

  const loadProgress = useCallback(async () => {
    if (!isAuth || allNodeIds.length === 0) return;
    try {
      const p = await fetchTopicProgress(allNodeIds);
      setProgress(p);
    } catch { /* ignore */ }
  }, [isAuth, allNodeIds]);

  useEffect(() => { loadProgress(); }, [loadProgress]);

  const completedSet = useMemo(() => {
    if (!progress) return new Set<string>();
    return new Set(progress.nodes.filter((n) => n.completed).map((n) => n.nodeId));
  }, [progress]);

  const handleToggle = useCallback(async (nodeId: string) => {
    if (!isAuth) return;
    try {
      const res = await toggleNodeProgress(nodeId);
      setProgress((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          completed: res.completed ? prev.completed + 1 : prev.completed - 1,
          nodes: prev.nodes.map((n) =>
            n.nodeId === nodeId ? { ...n, completed: res.completed } : n,
          ),
        };
      });
    } catch { /* ignore */ }
  }, [isAuth]);

  const graph = useMemo(() => {
    return buildGraphModel({ payload, mode, selectedNodeId });
  }, [payload, mode, selectedNodeId]);

  const handleKeySelectNode = useCallback((id: string | null) => {
    if (id) onSelect(id);
    else { setSelectedNodeId(null); setPanelOpen(false); }
  }, []);

  const handleKeyDepthChange = useCallback((delta: number) => {
    const next = Math.max(0, Math.min(4, payload.depth + delta));
    if (next !== payload.depth) onDepthChange(next);
  }, [payload.depth, onDepthChange]);

  const { showHelp, setShowHelp } = useGraphKeyboardNav({
    nodes: graph.nodes,
    selectedNodeId,
    onSelectNode: handleKeySelectNode,
    onDepthChange: handleKeyDepthChange,
  });

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return payload.nodes.find((n) => n.id === selectedNodeId) ?? null;
  }, [payload.nodes, selectedNodeId]);

  const onSelect = (id: string) => {
    setSelectedNodeId(id);

    const node = payload.nodes.find((n) => n.id === id);
    if (node?.role === "TOPIC" && node.id !== payload.topicId) {
      const q = new URLSearchParams();
      q.set("track", payload.track);
      q.set("depth", String(payload.depth));
      router.push(`/topic/${encodeURIComponent(node.id)}?${q.toString()}`);
      return;
    }

    // Auto-open details panel when clicking any non-topic node
    if (node && node.id !== payload.topicId) {
      setPanelOpen(true);
    }
  };

  const roleColor = (role: string) => `var(--role-${role.toLowerCase()})`;
  const roleBg = (role: string) => `var(--role-${role.toLowerCase()}-bg)`;

  const layerCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of payload.slots) {
      if (s.state === "visible") {
        counts[s.kind] = s.orderedNodeIds.length;
      }
    }
    return counts;
  }, [payload.slots]);

  return (
    <div className="h-[calc(100vh-120px)] relative">
      <div className="h-full w-full relative">
        {/* ── Floating toolbar ── */}
        <div className="absolute top-3 left-2 sm:left-3 z-10 flex flex-col sm:flex-row items-start sm:items-center gap-2 animate-fade-in">
          {/* Mode buttons */}
          <div className="glass-card !rounded-xl flex items-center p-1 gap-0.5 !transform-none">
            {MODE_LABELS.map(({ mode: m, label, icon }) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                disabled={m !== "overview" && !selectedNodeId}
                style={{
                  background: mode === m ? "var(--accent-subtle)" : "transparent",
                  color: mode === m ? "var(--accent)" : "var(--text-muted)",
                }}
                className="px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 disabled:opacity-30 hover:bg-[var(--bg-card-hover)] flex items-center gap-1.5"
              >
                <span className="text-[11px]">{icon}</span>
                {label}
              </button>
            ))}
          </div>

          {/* Depth control */}
          <div className="glass-card !rounded-xl px-3 py-2 flex items-center gap-3 !transform-none">
            <span style={{ color: "var(--text-muted)" }} className="text-xs font-medium">
              Depth
            </span>
            <DepthControl depth={payload.depth} onChange={onDepthChange} />
          </div>
        </div>

        {/* ── Details & keyboard help buttons ── */}
        <div className="absolute top-3 right-3 z-10 animate-fade-in flex items-center gap-2">
          <button
            onClick={() => setShowHelp(true)}
            className="glass-card !rounded-xl w-8 h-8 flex items-center justify-center text-xs font-bold !transform-none"
            style={{ color: "var(--text-muted)" }}
            title="Клавиатурные сокращения (?)"
          >
            ?
          </button>
          <button
            onClick={() => setPanelOpen((v) => !v)}
            className="glass-card !rounded-xl px-4 py-2 text-xs font-medium !transform-none"
            style={{
              background: panelOpen ? "var(--accent)" : undefined,
              color: panelOpen ? "#fff" : "var(--text-secondary)",
              borderColor: panelOpen ? "var(--accent)" : undefined,
            }}
          >
            {panelOpen ? "✕ Закрыть" : "☰ Детали"}
          </button>
        </div>

        {/* ── Layer indicators ── */}
        <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-1.5 animate-fade-in delay-2">
          {payload.slots.map((s, idx) => {
            const isVisible = s.state === "visible";
            const count = layerCounts[s.kind] ?? 0;
            return (
              <div
                key={s.kind}
                className="glass-card !rounded-lg px-3 py-1.5 flex items-center gap-2 text-xs !transform-none"
                style={{
                  opacity: isVisible ? 1 : 0.35,
                  animationDelay: `${idx * 60}ms`,
                }}
              >
                <div
                  className="w-2 h-2 rounded-full transition-colors duration-300"
                  style={{
                    background: isVisible ? "var(--accent)" : "var(--border)",
                    boxShadow: isVisible ? "0 0 6px var(--accent-glow)" : "none",
                  }}
                />
                <span style={{ color: "var(--text-secondary)" }}>{s.kind}</span>
                {isVisible && (
                  <span style={{ color: "var(--accent)" }} className="font-semibold">
                    {count}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Graph / Mobile list ── */}
        {isMobile ? (
          <MobileGraphList
            payload={payload}
            selectedNodeId={selectedNodeId}
            onSelectNode={onSelect}
          />
        ) : (
          <GraphView
            nodes={graph.nodes}
            edges={graph.edges}
            selectedNodeId={selectedNodeId}
            onSelectNodeId={onSelect}
          />
        )}
      </div>

      {/* ── Side panel (desktop: slide from right / mobile: bottom sheet) ── */}
      <div
        ref={panelRef}
        className="absolute z-20 overflow-y-auto
          sm:top-0 sm:right-0 sm:h-full sm:w-[400px]
          bottom-0 left-0 right-0 sm:bottom-auto sm:left-auto"
        style={{
          background: "var(--bg-secondary)",
          borderLeft: isMobile ? "none" : "1px solid var(--border)",
          borderTop: isMobile ? "1px solid var(--border)" : "none",
          borderRadius: isMobile ? "20px 20px 0 0" : 0,
          maxHeight: isMobile ? "82vh" : "100%",
          transform: panelOpen
            ? "translate(0, 0)"
            : isMobile ? "translateY(100%)" : "translateX(100%)",
          opacity: panelOpen ? 1 : 0,
          transition: "transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease",
          boxShadow: isMobile ? "0 -8px 32px rgba(0,0,0,0.25)" : "none",
        }}
      >
        {/* Mobile drag handle */}
        {isMobile && (
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full" style={{ background: "var(--border)" }} />
          </div>
        )}

        <div className="p-5 sm:p-6">
          {/* Panel header */}
          <div className="flex items-center justify-between mb-5">
            <span
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: "var(--text-muted)" }}
            >
              Детали темы
            </span>
            <button
              onClick={() => setPanelOpen(false)}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--bg-card)]"
              style={{ color: "var(--text-muted)" }}
            >
              ✕
            </button>
          </div>

          {/* Progress bar */}
          {isAuth && progress && progress.total > 0 && (
            <div className="glass-card p-4 mb-5 !transform-none animate-fade-in">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                  Прогресс
                </span>
                <span className="text-xs font-bold" style={{ color: "var(--accent)" }}>
                  {progress.completed}/{progress.total}
                </span>
              </div>
              <div
                className="w-full h-2 rounded-full overflow-hidden"
                style={{ background: "var(--bg-input)" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.round((progress.completed / progress.total) * 100)}%`,
                    background: progress.completed === progress.total
                      ? "linear-gradient(90deg, #10b981, #34d399)"
                      : "linear-gradient(90deg, var(--accent), var(--accent-hover))",
                  }}
                />
              </div>
              {progress.completed === progress.total && (
                <div className="text-[10px] mt-1.5 text-center font-medium" style={{ color: "#10b981" }}>
                  Тема изучена!
                </div>
              )}
            </div>
          )}

          {/* Prereq mode hint */}
          {mode === "prereq" && selectedNode && (
            <div
              className="rounded-xl p-3 mb-4 text-xs animate-fade-in"
              style={{
                background: "rgba(245,158,11,0.08)",
                border: "1px solid rgba(245,158,11,0.3)",
                color: "#f59e0b",
              }}
            >
              <span className="font-semibold">↑ Зависимости</span>
              <span className="ml-1.5" style={{ color: "var(--text-secondary)" }}>
                — подсвечены узлы, которые нужно изучить перед <b>{selectedNode.title}</b>
              </span>
            </div>
          )}

          {/* Selected node */}
          {selectedNode && (
            <div className="glass-card p-4 mb-5 animate-fade-in-scale !transform-none">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold">{selectedNode.title}</div>
                {isAuth && selectedNode.role !== "TOPIC" && (
                  <button
                    onClick={() => handleToggle(selectedNode.id)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200"
                    style={{
                      background: completedSet.has(selectedNode.id)
                        ? "rgba(16,185,129,0.15)"
                        : "var(--bg-input)",
                      color: completedSet.has(selectedNode.id)
                        ? "#10b981"
                        : "var(--text-muted)",
                      border: `1px solid ${completedSet.has(selectedNode.id) ? "rgba(16,185,129,0.3)" : "var(--border)"}`,
                    }}
                  >
                    <span>{completedSet.has(selectedNode.id) ? "✓" : "○"}</span>
                    {completedSet.has(selectedNode.id) ? "Изучено" : "Отметить"}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span
                  className="badge"
                  style={{ background: roleBg(selectedNode.role), color: roleColor(selectedNode.role) }}
                >
                  {selectedNode.role}
                </span>
                {selectedNode.fipiCode && (
                  <span
                    className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded"
                    style={{
                      background: "rgba(250,204,21,0.12)",
                      color: "#facc15",
                      border: "1px solid rgba(250,204,21,0.25)",
                    }}
                  >
                    ЕГЭ {selectedNode.fipiCode}
                  </span>
                )}
                {selectedNode.isExternal && (
                  <span style={{ color: "var(--text-muted)" }} className="text-xs">
                    пререквизит
                  </span>
                )}
              </div>

              {selectedNode.description && (
                <div className="mb-3">
                  <MarkdownContent>{selectedNode.description}</MarkdownContent>
                </div>
              )}

              {selectedNode.content && (
                <div
                  className="p-3 rounded-lg mb-3"
                  style={{ background: "var(--bg-input)" }}
                >
                  <MarkdownContent>{selectedNode.content}</MarkdownContent>
                </div>
              )}

              {selectedNode.resources && selectedNode.resources.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>
                    Ресурсы
                  </div>
                  {selectedNode.resources.map((url, i) =>
                    isVideoUrl(url) ? (
                      <VideoEmbed key={i} url={url} />
                    ) : (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-xs truncate mb-1 transition-colors hover:text-[var(--accent)]"
                        style={{ color: "var(--accent)" }}
                      >
                        {url}
                      </a>
                    )
                  )}
                </div>
              )}
            </div>
          )}

          {/* Node note */}
          {isAuth && selectedNode && selectedNode.id !== payload.topicId && (
            <div className="glass-card p-4 mb-5 !transform-none">
              <NodeNoteEditor nodeId={selectedNode.id} />
            </div>
          )}

          {/* Quiz */}
          {selectedNode && selectedNode.id !== payload.topicId && (
            <div className="glass-card p-4 mb-5 !transform-none">
              <NodeQuizPanel nodeId={selectedNode.id} isAuth={isAuth} />
            </div>
          )}

          {/* Study Plan */}
          <div className="mb-5">
            <StudyPlanPanel goalTopicId={payload.topicId} />
          </div>

          {/* Knowledge Layers */}
          <SlotsPanel payload={payload} />
        </div>
      </div>

      {/* ── Backdrop ── */}
      {panelOpen && (
        <div
          className="absolute inset-0 z-[15]"
          style={{ background: "rgba(0,0,0,0.2)" }}
          onClick={() => setPanelOpen(false)}
        />
      )}

      {/* ── AI Chat ── */}
      <ChatButton topicId={payload.topicId} />

      {/* ── Keyboard shortcuts help ── */}
      {showHelp && <KeyboardShortcutsHelp onClose={() => setShowHelp(false)} />}
    </div>
  );
}
