"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
import { DiagnosticModal } from "@/features/quiz/ui/DiagnosticModal";
import { OnboardingTour } from "./OnboardingTour";
import { VideoEmbed, isVideoUrl } from "@/features/graph-view/ui/VideoEmbed";
import { useMobileDetect } from "@/hooks/useMobileDetect";
import { useSwipeDown } from "@/hooks/useSwipeDown";
import { useRef } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { fetchTopicProgress, toggleNodeProgress, fetchUnlocked, recordNodeView, type TopicProgress, type MasteryLevel } from "@/lib/progressApi";

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
  // Deep link: a ?node= param selects that node and opens the panel on load.
  const initialNode = (): string | null => {
    if (typeof window === "undefined") return null;
    const n = new URLSearchParams(window.location.search).get("node");
    return n && payload.nodes.some((x) => x.id === n) ? n : null;
  };

  const [mode, setMode] = useState<GraphUIMode>("overview");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(initialNode);
  const [panelOpen, setPanelOpen] = useState(() => {
    const n = initialNode();
    return !!(n && n !== payload.topicId);
  });
  const [progress, setProgress] = useState<TopicProgress | null>(null);
  const [heatmap, setHeatmap] = useState(false);
  const [unlockedSet, setUnlockedSet] = useState<Set<string>>(new Set());
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [panelTab, setPanelTab] = useState<"theory" | "tasks" | "notes" | "links">("theory");
  const [showOnboarding, setShowOnboarding] = useState(
    () => typeof window !== "undefined" && !localStorage.getItem("mw-topic-onboarded"),
  );
  const panelRef = useRef<HTMLDivElement>(null);

  const closeOnboarding = () => {
    setShowOnboarding(false);
    if (typeof window !== "undefined") localStorage.setItem("mw-topic-onboarded", "1");
  };
  useSwipeDown(panelRef, () => setPanelOpen(false));

  // Load progress for all nodes in the topic
  const allNodeIds = useMemo(
    () => payload.nodes.filter((n) => n.id !== payload.topicId).map((n) => n.id),
    [payload.nodes, payload.topicId],
  );

  useEffect(() => {
    if (!isAuth || allNodeIds.length === 0) return;
    fetchTopicProgress(allNodeIds)
      .then(setProgress)
      .catch(() => { /* ignore */ });
  }, [isAuth, allNodeIds]);

  const completedSet = useMemo(() => {
    if (!progress) return new Set<string>();
    return new Set(progress.nodes.filter((n) => n.completed).map((n) => n.nodeId));
  }, [progress]);

  const masteryByNodeId = useMemo(() => {
    const map = new Map<string, MasteryLevel>();
    if (progress) for (const n of progress.nodes) map.set(n.nodeId, n.mastery);
    return map;
  }, [progress]);

  useEffect(() => {
    if (!isAuth || allNodeIds.length === 0) return;
    const topicSet = new Set(allNodeIds);
    fetchUnlocked()
      .then((ids) => setUnlockedSet(new Set(ids.filter((id) => topicSet.has(id)))))
      .catch(() => { /* ignore */ });
  }, [isAuth, allNodeIds]);

  const nodeTitleById = useMemo(
    () => new Map(payload.nodes.map((n) => [n.id, n.title])),
    [payload.nodes],
  );

  // After a diagnostic: pull fresh mastery + unlocked and switch on the heatmap
  const handleDiagnosticComplete = useCallback(() => {
    if (isAuth && allNodeIds.length > 0) {
      const topicSet = new Set(allNodeIds);
      fetchTopicProgress(allNodeIds).then(setProgress).catch(() => {});
      fetchUnlocked()
        .then((ids) => setUnlockedSet(new Set(ids.filter((id) => topicSet.has(id)))))
        .catch(() => {});
    }
    setHeatmap(true);
  }, [isAuth, allNodeIds]);

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
            n.nodeId === nodeId ? { ...n, completed: res.completed, mastery: res.mastery } : n,
          ),
        };
      });
      // completing a node may unlock its dependents — refresh the set
      const topicSet = new Set(allNodeIds);
      fetchUnlocked()
        .then((ids) => setUnlockedSet(new Set(ids.filter((id) => topicSet.has(id)))))
        .catch(() => { /* ignore */ });
    } catch { /* ignore */ }
  }, [isAuth, allNodeIds]);

  const prereqEdges = useMemo(
    () => payload.edges.filter((e) => e.kind === "PREREQ_REQUIRED").map((e) => ({ from: e.from, to: e.to })),
    [payload.edges],
  );

  // Gaps = prerequisite ancestors of the selected node that aren't completed yet
  const gapSet = useMemo(() => {
    if (!selectedNodeId) return new Set<string>();
    const prereqEdges = payload.edges.filter((e) => e.kind === "PREREQ_REQUIRED");
    const visited = new Set<string>();
    const queue = [selectedNodeId];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const e of prereqEdges) {
        if (e.to === cur && !visited.has(e.from)) {
          visited.add(e.from);
          queue.push(e.from);
        }
      }
    }
    const gaps = new Set<string>();
    for (const id of visited) if (!completedSet.has(id)) gaps.add(id);
    return gaps;
  }, [selectedNodeId, payload.edges, completedSet]);

  const graph = useMemo(() => {
    return buildGraphModel({
      payload, mode, selectedNodeId,
      masteryByNodeId, completedSet, unlockedSet, gapSet, heatmap,
    });
  }, [payload, mode, selectedNodeId, masteryByNodeId, completedSet, unlockedSet, gapSet, heatmap]);

  const onSelect = useCallback((id: string) => {
    setSelectedNodeId(id);
    setPanelTab("theory");

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
      if (isAuth) recordNodeView(id);
    }
  }, [payload, router, isAuth]);

  const handleKeySelectNode = useCallback((id: string | null) => {
    if (id) onSelect(id);
    else { setSelectedNodeId(null); setPanelOpen(false); }
  }, [onSelect]);

  const handleKeyDepthChange = useCallback((delta: number) => {
    const next = Math.max(0, Math.min(4, payload.depth + delta));
    if (next !== payload.depth) onDepthChange(next);
  }, [payload.depth, onDepthChange]);

  const { showHelp, setShowHelp } = useGraphKeyboardNav({
    nodes: graph.nodes,
    selectedNodeId,
    onSelectNode: handleKeySelectNode,
    onDepthChange: handleKeyDepthChange,
    onActivate: () => {
      if (selectedNodeId && selectedNodeId !== payload.topicId) setPanelOpen(true);
    },
    onToggleComplete: () => {
      if (isAuth && selectedNodeId && selectedNodeId !== payload.topicId) handleToggle(selectedNodeId);
    },
  });

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return payload.nodes.find((n) => n.id === selectedNodeId) ?? null;
  }, [payload.nodes, selectedNodeId]);

  // Keep the URL in sync with the current selection (shareable deep link)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (selectedNodeId && selectedNodeId !== payload.topicId) url.searchParams.set("node", selectedNodeId);
    else url.searchParams.delete("node");
    window.history.replaceState(window.history.state, "", url.toString());
  }, [selectedNodeId, payload.topicId]);

  const copyNodeLink = () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    navigator.clipboard.writeText(window.location.href)
      .then(() => {
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 1500);
      })
      .catch(() => {});
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
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="absolute top-3 left-2 sm:left-3 z-10 flex flex-col sm:flex-row items-start sm:items-center gap-2"
        >
          {/* Mode buttons */}
          <div className="glass-card !rounded-xl flex items-center p-1 gap-0.5 !transform-none">
            {MODE_LABELS.map(({ mode: m, label, icon }) => (
              <motion.button
                key={m}
                onClick={() => setMode(m)}
                disabled={m !== "overview" && !selectedNodeId}
                whileTap={{ scale: 0.95 }}
                style={{
                  background: mode === m ? "var(--accent-subtle)" : "transparent",
                  color: mode === m ? "var(--accent)" : "var(--text-muted)",
                  position: "relative",
                }}
                className="px-3 py-2 rounded-lg text-xs font-medium transition-colors duration-150 disabled:opacity-30 flex items-center gap-1.5"
              >
                {mode === m && (
                  <motion.div
                    layoutId="mode-active"
                    className="absolute inset-0 rounded-lg"
                    style={{ background: "var(--accent-subtle)" }}
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <span className="relative text-[11px]">{icon}</span>
                <span className="relative">{label}</span>
              </motion.button>
            ))}
          </div>

          {/* Depth control */}
          <div className="glass-card !rounded-xl px-3 py-2 flex items-center gap-3 !transform-none">
            <span style={{ color: "var(--text-muted)" }} className="text-xs font-medium">
              Depth
            </span>
            <DepthControl depth={payload.depth} onChange={onDepthChange} />
          </div>

          {/* Heatmap toggle */}
          {isAuth && (
            <button
              onClick={() => setHeatmap((v) => !v)}
              className="glass-card !rounded-xl px-3 py-2 flex items-center gap-2 !transform-none text-xs font-medium"
              style={{
                color: heatmap ? "var(--accent)" : "var(--text-muted)",
                outline: heatmap ? "1px solid var(--accent)" : "none",
              }}
              title="Тепловая карта владения: цвет узла = уровень освоения"
            >
              <span style={{ fontSize: 13 }}>◍</span>
              <span className="hidden sm:inline">Карта прогресса</span>
            </button>
          )}

          {/* Diagnostic */}
          {isAuth && (
            <button
              onClick={() => setShowDiagnostic(true)}
              className="glass-card !rounded-xl px-3 py-2 flex items-center gap-2 !transform-none text-xs font-medium"
              style={{ color: "var(--accent)" }}
              title="Пройти диагностику и найти пробелы"
            >
              <span style={{ fontSize: 13 }}>✓</span>
              <span className="hidden sm:inline">Диагностика</span>
            </button>
          )}
        </motion.div>

        {/* ── Details & keyboard help buttons ── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05, ease: "easeOut" }}
          className="absolute top-3 right-3 z-10 flex items-center gap-2"
        >
          <motion.button
            onClick={() => setShowHelp(true)}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className="glass-card !rounded-xl w-8 h-8 flex items-center justify-center text-xs font-bold !transform-none"
            style={{ color: "var(--text-muted)" }}
            title="Клавиатурные сокращения (?)"
          >
            ?
          </motion.button>
          <motion.button
            onClick={() => setPanelOpen((v) => !v)}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className="glass-card !rounded-xl px-4 py-2 text-xs font-medium !transform-none"
            style={{
              background: panelOpen ? "var(--accent)" : undefined,
              color: panelOpen ? "#fff" : "var(--text-secondary)",
              borderColor: panelOpen ? "var(--accent)" : undefined,
            }}
          >
            {panelOpen ? "✕ Закрыть" : "☰ Детали"}
          </motion.button>
        </motion.div>

        {/* ── Layer indicators ── */}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
          className="absolute bottom-3 left-3 z-10 flex flex-col gap-1.5"
        >
          {payload.slots.map((s, idx) => {
            const isVisible = s.state === "visible";
            const count = layerCounts[s.kind] ?? 0;
            return (
              <motion.div
                key={s.kind}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: isVisible ? 1 : 0.35, x: 0 }}
                transition={{ delay: 0.1 + idx * 0.05, duration: 0.3 }}
                className="glass-card !rounded-lg px-3 py-1.5 flex items-center gap-2 text-xs !transform-none"
              >
                <motion.div
                  animate={{
                    background: isVisible ? "var(--accent)" : "var(--border)",
                    boxShadow: isVisible ? "0 0 6px var(--accent-glow)" : "none",
                  }}
                  transition={{ duration: 0.3 }}
                  className="w-2 h-2 rounded-full"
                />
                <span style={{ color: "var(--text-secondary)" }}>{s.kind}</span>
                <AnimatePresence>
                  {isVisible && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.7 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.7 }}
                      style={{ color: "var(--accent)" }}
                      className="font-semibold"
                    >
                      {count}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </motion.div>

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
            prereqEdges={prereqEdges}
          />
        )}
      </div>

      {/* ── Side panel + Backdrop ── */}
      <AnimatePresence>
        {panelOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 z-[15]"
              style={{ background: "rgba(0,0,0,0.25)" }}
              onClick={() => setPanelOpen(false)}
            />

            {/* Panel */}
            <motion.div
              key="panel"
              ref={panelRef}
              initial={isMobile ? { y: "100%" } : { x: "100%" }}
              animate={isMobile ? { y: 0 } : { x: 0 }}
              exit={isMobile ? { y: "100%" } : { x: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
              className="absolute z-20 overflow-y-auto
                sm:top-0 sm:right-0 sm:h-full sm:w-[400px]
                bottom-0 left-0 right-0 sm:bottom-auto sm:left-auto"
              style={{
                background: "var(--bg-secondary)",
                borderLeft: isMobile ? "none" : "1px solid var(--border)",
                borderTop: isMobile ? "1px solid var(--border)" : "none",
                borderRadius: isMobile ? "20px 20px 0 0" : 0,
                maxHeight: isMobile ? "82vh" : "100%",
                boxShadow: isMobile ? "0 -8px 32px rgba(0,0,0,0.25)" : "-4px 0 24px rgba(0,0,0,0.15)",
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
                  <div className="flex items-center gap-1">
                    <button
                      onClick={copyNodeLink}
                      title="Скопировать ссылку на этот узел"
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors hover:bg-[var(--bg-card)]"
                      style={{ color: linkCopied ? "var(--success)" : "var(--text-muted)" }}
                    >
                      {linkCopied ? "✓" : "⎘"}
                    </button>
                    <motion.button
                      onClick={() => setPanelOpen(false)}
                      whileHover={{ scale: 1.1, rotate: 90 }}
                      whileTap={{ scale: 0.9 }}
                      transition={{ type: "spring", stiffness: 400, damping: 20 }}
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--bg-card)]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      ✕
                    </motion.button>
                  </div>
                </div>

                {/* Progress bar */}
                {isAuth && progress && progress.total > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="glass-card p-4 mb-5 !transform-none"
                  >
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
                      <motion.div
                        className="h-full rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.round((progress.completed / progress.total) * 100)}%` }}
                        transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
                        style={{
                          background: progress.completed === progress.total
                            ? "linear-gradient(90deg, #10b981, #34d399)"
                            : "linear-gradient(90deg, var(--accent), var(--accent-hover))",
                        }}
                      />
                    </div>
                    {progress.completed === progress.total && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-[10px] mt-1.5 text-center font-medium"
                        style={{ color: "#10b981" }}
                      >
                        Тема изучена!
                      </motion.div>
                    )}
                  </motion.div>
                )}

                {/* Prereq mode hint */}
                <AnimatePresence>
                  {mode === "prereq" && selectedNode && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="rounded-xl p-3 mb-4 text-xs overflow-hidden"
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
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Selected node */}
                <AnimatePresence mode="wait">
                  {selectedNode && (
                    <motion.div
                      key={selectedNode.id}
                      initial={{ opacity: 0, y: 10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.97 }}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      className="glass-card p-4 mb-5 !transform-none"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-semibold">{selectedNode.title}</div>
                        {isAuth && selectedNode.role !== "TOPIC" && (
                          <motion.button
                            onClick={() => handleToggle(selectedNode.id)}
                            whileTap={{ scale: 0.92 }}
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
                            <motion.span
                              animate={{ rotate: completedSet.has(selectedNode.id) ? 0 : -10 }}
                              transition={{ type: "spring", stiffness: 400 }}
                            >
                              {completedSet.has(selectedNode.id) ? "✓" : "○"}
                            </motion.span>
                            {completedSet.has(selectedNode.id) ? "Изучено" : "Отметить"}
                          </motion.button>
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

                      {/* Tabs */}
                      <div className="flex gap-1 p-1 rounded-xl mb-4" style={{ background: "var(--bg-input)" }}>
                        {([
                          { id: "theory", label: "Теория" },
                          { id: "tasks", label: "Задачи" },
                          { id: "notes", label: "Заметки" },
                          { id: "links", label: "Связи", count: gapSet.size },
                        ] as const).map((t) => {
                          const on = panelTab === t.id;
                          return (
                            <button
                              key={t.id}
                              onClick={() => setPanelTab(t.id)}
                              className="flex-1 py-1.5 rounded-lg text-[11px] font-medium transition-colors flex items-center justify-center gap-1"
                              style={{
                                background: on ? "var(--bg-secondary)" : "transparent",
                                color: on ? "var(--accent)" : "var(--text-muted)",
                              }}
                            >
                              {t.label}
                              {"count" in t && t.count > 0 && (
                                <span className="text-[9px] px-1 rounded-full" style={{ background: "rgba(255,107,107,0.18)", color: "var(--danger)" }}>
                                  {t.count}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Теория */}
                      {panelTab === "theory" && (
                        <div>
                          {selectedNode.description && (
                            <div className="mb-3">
                              <MarkdownContent>{selectedNode.description}</MarkdownContent>
                            </div>
                          )}
                          {selectedNode.content && (
                            <div className="p-3 rounded-lg mb-3" style={{ background: "var(--bg-input)" }}>
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
                          {!selectedNode.description && !selectedNode.content && !(selectedNode.resources && selectedNode.resources.length > 0) && (
                            <div className="text-xs py-4 text-center" style={{ color: "var(--text-muted)" }}>
                              Для этого узла пока нет теории
                            </div>
                          )}
                        </div>
                      )}

                      {/* Задачи */}
                      {panelTab === "tasks" && (
                        selectedNode.id !== payload.topicId ? (
                          <NodeQuizPanel nodeId={selectedNode.id} isAuth={isAuth} />
                        ) : (
                          <div className="text-xs py-4 text-center" style={{ color: "var(--text-muted)" }}>
                            Выберите узел темы, чтобы порешать
                          </div>
                        )
                      )}

                      {/* Заметки */}
                      {panelTab === "notes" && (
                        isAuth && selectedNode.id !== payload.topicId ? (
                          <NodeNoteEditor nodeId={selectedNode.id} />
                        ) : (
                          <div className="text-xs py-4 text-center" style={{ color: "var(--text-muted)" }}>
                            {isAuth ? "Заметки доступны для узлов темы" : "Войдите, чтобы вести заметки"}
                          </div>
                        )
                      )}

                      {/* Связи / пробелы */}
                      {panelTab === "links" && (
                        isAuth && gapSet.size > 0 ? (
                          <div className="rounded-xl p-3" style={{ background: "rgba(255,107,107,0.06)", border: "1px solid rgba(255,107,107,0.25)" }}>
                            <div className="flex items-center gap-1.5 mb-2">
                              <span style={{ color: "var(--danger)" }} className="text-xs font-semibold">
                                Пробелы — изучи перед этим
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(255,107,107,0.15)", color: "var(--danger)" }}>
                                {gapSet.size}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {[...gapSet].map((gid) => {
                                const gn = payload.nodes.find((n) => n.id === gid);
                                return (
                                  <button
                                    key={gid}
                                    onClick={() => onSelect(gid)}
                                    className="text-[11px] px-2 py-1 rounded-lg transition-colors hover:border-[var(--danger)]"
                                    style={{ background: "var(--bg-card)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                                  >
                                    {gn?.title ?? gid}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs py-4 text-center" style={{ color: "var(--text-muted)" }}>
                            {isAuth ? "Пробелов нет — все пререквизиты пройдены" : "Войдите, чтобы видеть пробелы"}
                          </div>
                        )
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Study Plan */}
                <div className="mb-5">
                  <StudyPlanPanel goalTopicId={payload.topicId} />
                </div>

                {/* Knowledge Layers */}
                <SlotsPanel payload={payload} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── AI Chat ── */}
      <ChatButton topicId={payload.topicId} />

      {/* ── Keyboard shortcuts help ── */}
      {showHelp && <KeyboardShortcutsHelp onClose={() => setShowHelp(false)} />}

      {/* ── Diagnostic modal ── */}
      <AnimatePresence>
        {showDiagnostic && (
          <DiagnosticModal
            topicId={payload.topicId}
            topicTitle={payload.nodes.find((n) => n.id === payload.topicId)?.title ?? "Тема"}
            nodeTitleById={nodeTitleById}
            onClose={() => setShowDiagnostic(false)}
            onComplete={handleDiagnosticComplete}
          />
        )}
      </AnimatePresence>

      {/* ── First-visit onboarding ── */}
      <AnimatePresence>
        {showOnboarding && <OnboardingTour onClose={closeOnboarding} />}
      </AnimatePresence>
    </div>
  );
}
