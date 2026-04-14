"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  MarkerType,
  type NodeTypes,
  type Edge,
} from "reactflow";
import { fetchRoadmap, type RoadmapPayload } from "@/lib/roadmapApi";
import { buildRoadmapGraph } from "../utils/buildRoadmapGraph";
import { RoadmapTopicNode, RoadmapChildNode } from "./RoadmapNodes";
import { Graph3DView } from "@/features/graph-view/ui/Graph3DView";
import { useTheme } from "@/providers/ThemeProvider";

type ViewMode = "2d" | "3d";

const nodeTypes: NodeTypes = {
  roadmapTopic: RoadmapTopicNode,
  roadmapChild: RoadmapChildNode,
};

const DEPTH_LABELS = [
  "Только темы",
  "+ Понятия",
  "+ Методы",
  "+ Навыки",
  "+ Задачи",
];

const LEGEND_ITEMS = [
  { role: "TOPIC", label: "Тема", minDepth: 0 },
  { role: "CONCEPT", label: "Понятие", minDepth: 1 },
  { role: "METHOD", label: "Метод", minDepth: 2 },
  { role: "SKILL", label: "Навык", minDepth: 3 },
  { role: "TASK", label: "Задача", minDepth: 4 },
];

export function RoadmapView() {
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const [track] = useState("school");
  const [depth, setDepth] = useState(0);
  const [payload, setPayload] = useState<RoadmapPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>("2d");

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setErr(null);

    fetchRoadmap({ track, depth, signal: ac.signal })
      .then((data) => {
        setPayload(data);
        if (depth > 0) {
          const topicIds = data.nodes
            .filter((n) => n.role === "TOPIC")
            .map((n) => n.id);
          setExpandedTopics(new Set(topicIds));
        } else {
          setExpandedTopics(new Set());
        }
      })
      .catch((e) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        if (e?.message?.includes("aborted")) return;
        setErr(e instanceof Error ? e.message : "Unknown error");
      })
      .finally(() => setLoading(false));

    return () => ac.abort();
  }, [track, depth]);

  const graph = useMemo(() => {
    if (!payload) return { nodes: [], edges: [] };
    return buildRoadmapGraph({ payload, expandedTopics });
  }, [payload, expandedTopics]);

  const styledEdges = useMemo(() => {
    return graph.edges.map((e: Edge) => ({
      ...e,
      style: {
        stroke: "var(--border)",
        strokeWidth: 1.5,
        opacity: 0.5,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: "var(--border)",
        width: 14,
        height: 14,
      },
    }));
  }, [graph.edges]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: { id: string; type?: string }) => {
      if (node.type === "roadmapTopic") {
        if (depth > 0) {
          setExpandedTopics((prev) => {
            const next = new Set(prev);
            if (next.has(node.id)) next.delete(node.id);
            else next.add(node.id);
            return next;
          });
        } else {
          router.push(`/topic/${node.id}?track=${track}&depth=0`);
        }
      } else if (node.type === "roadmapChild") {
        const n = payload?.nodes.find((x) => x.id === node.id);
        if (n?.parentTopicId) {
          router.push(`/topic/${n.parentTopicId}?track=${track}&depth=${depth}`);
        }
      }
    },
    [depth, track, router, payload],
  );

  return (
    <div className="h-screen flex flex-col" style={{ background: "var(--bg-primary)" }}>
      {/* ── Header ── */}
      <header
        className="shrink-0 z-50"
        style={{
          background: "var(--bg-glass)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6 py-2 sm:py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3 sm:gap-4">
            <Link href="/" className="flex items-center gap-2 sm:gap-3 group">
              <div
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center font-bold text-sm shadow-lg"
                style={{
                  background: "linear-gradient(135deg, var(--accent), var(--accent-hover))",
                  color: "#fff",
                }}
              >
                M
              </div>
              <span className="font-bold text-base sm:text-lg tracking-tight">MathGraph</span>
            </Link>
            <span className="badge badge-accent hidden sm:inline-flex">Roadmap</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-5 flex-wrap">
            {/* Depth selector */}
            <div className="flex items-center gap-1.5 sm:gap-2.5">
              <span className="text-xs font-medium hidden sm:inline" style={{ color: "var(--text-muted)" }}>
                Depth
              </span>
              <div
                className="rounded-xl flex items-center p-0.5 sm:p-1 gap-0.5"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
              >
                {[0, 1, 2, 3, 4].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDepth(d)}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-xs font-bold transition-all duration-200 hover:scale-105"
                    style={{
                      background: d <= depth
                        ? "linear-gradient(135deg, var(--accent), var(--accent-hover))"
                        : "transparent",
                      color: d <= depth ? "#fff" : "var(--text-muted)",
                      boxShadow: d <= depth ? "0 2px 8px var(--accent-glow)" : "none",
                    }}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <span className="text-xs hidden lg:inline" style={{ color: "var(--text-secondary)" }}>
                {DEPTH_LABELS[depth]}
              </span>
            </div>

            {/* Legend */}
            <div className="hidden md:flex items-center gap-2.5">
              {LEGEND_ITEMS.filter((l) => l.minDepth <= depth).map(({ role, label }) => (
                <div key={role} className="flex items-center gap-1.5 animate-fade-in">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: `var(--role-${role.toLowerCase()})` }}
                  />
                  <span className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>

            {/* 2D / 3D toggle */}
            <div
              className="rounded-xl flex items-center p-0.5 sm:p-1 gap-0.5"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
            >
              {(["2d", "3d"] as ViewMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setViewMode(m)}
                  className="px-2.5 py-1.5 sm:px-3 rounded-lg text-xs font-bold transition-all duration-200"
                  style={{
                    background: viewMode === m
                      ? "linear-gradient(135deg, var(--accent), var(--accent-hover))"
                      : "transparent",
                    color: viewMode === m ? "#fff" : "var(--text-muted)",
                    boxShadow: viewMode === m ? "0 2px 8px var(--accent-glow)" : "none",
                  }}
                >
                  {m.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Theme */}
            <button
              onClick={toggle}
              className="btn-ghost w-8 h-8 sm:w-9 sm:h-9 !p-0 flex items-center justify-center text-base"
            >
              {theme === "dark" ? "\u2600\uFE0F" : "\uD83C\uDF19"}
            </button>
          </div>
        </div>
      </header>

      {/* ── Graph ── */}
      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 animate-fade-in">
            <div className="text-center">
              <div
                className="w-10 h-10 rounded-full border-2 border-t-transparent mx-auto mb-3"
                style={{
                  borderColor: "var(--border)",
                  borderTopColor: "var(--accent)",
                  animation: "spin-slow 1s linear infinite",
                }}
              />
              <div style={{ color: "var(--text-muted)" }} className="text-sm">
                Загрузка roadmap...
              </div>
            </div>
          </div>
        )}

        {err && (
          <div
            className="absolute top-4 left-1/2 -translate-x-1/2 z-10 rounded-xl px-5 py-3 text-sm animate-fade-in-scale"
            style={{
              background: "rgba(248,113,133,0.08)",
              color: "var(--danger)",
              border: "1px solid rgba(248,113,133,0.2)",
            }}
          >
            {err}
          </div>
        )}

        {!loading && payload && viewMode === "2d" && (
          <ReactFlow
            nodes={graph.nodes}
            edges={styledEdges}
            nodeTypes={nodeTypes}
            onNodeClick={onNodeClick}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            proOptions={{ hideAttribution: true }}
            minZoom={0.2}
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
        )}

        {!loading && payload && viewMode === "3d" && (
          <Graph3DView
            nodes={payload.nodes.map((n) => ({ id: n.id, title: n.title, role: n.role }))}
            edges={payload.edges.map((e) => ({ from: e.from, to: e.to, kind: e.kind }))}
            onSelectNode={(id) => {
              const node = payload.nodes.find((n) => n.id === id);
              if (!node) return;
              if (node.role === "TOPIC") {
                router.push(`/topic/${node.id}?track=${track}&depth=0`);
              } else if (node.parentTopicId) {
                router.push(`/topic/${node.parentTopicId}?track=${track}&depth=${depth}`);
              }
            }}
          />
        )}

        {/* Hint */}
        {!loading && payload && (
          <div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs px-4 py-2 rounded-xl animate-fade-in delay-3"
            style={{
              color: "var(--text-muted)",
              background: "var(--bg-glass)",
              backdropFilter: "blur(8px)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            {depth === 0
              ? "Нажми на тему чтобы открыть. Увеличь Depth чтобы увидеть понятия, методы, навыки, задачи."
              : "Нажми на тему чтобы раскрыть/свернуть. Нажми на элемент чтобы перейти к теме."}
          </div>
        )}
      </div>
    </div>
  );
}
