"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/providers/AuthProvider";
import { fetchProgressSummary, type ProgressSummaryItem } from "@/lib/progressApi";
import { PRESETS, type Preset } from "@/lib/presets";

// ── Progress ring SVG ─────────────────────────────────────────────────────────
function ProgressRing({
  pct,
  color,
  size = 52,
}: {
  pct: number;
  color: string;
  size?: number;
}) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--bg-input)"
        strokeWidth={5}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={5}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.6s ease" }}
      />
    </svg>
  );
}

// ── Single preset card ────────────────────────────────────────────────────────
function PresetCard({
  preset,
  progressMap,
  isAuth,
}: {
  preset: Preset;
  progressMap: Map<string, ProgressSummaryItem>;
  isAuth: boolean;
}) {
  const totalTopics = preset.topics.length;

  // Count topics where all nodes are completed
  const completedTopics = preset.topics.filter((t) => {
    const p = progressMap.get(t.id);
    return p && p.total > 0 && p.completed >= p.total;
  }).length;

  const startedTopics = preset.topics.filter((t) => {
    const p = progressMap.get(t.id);
    return p && p.completed > 0;
  }).length;

  const pct = totalTopics > 0 ? completedTopics / totalTopics : 0;

  // Find first topic that isn't fully completed → "продолжить"
  const nextTopic =
    preset.topics.find((t) => {
      const p = progressMap.get(t.id);
      return !p || p.total === 0 || p.completed < p.total;
    }) ?? preset.topics[0];

  const done = completedTopics === totalTopics;

  return (
    <div
      className="rounded-2xl overflow-hidden animate-fade-in"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      {/* Top accent bar */}
      <div className="h-1" style={{ background: preset.color }} />

      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{preset.icon}</span>
            <div>
              <h2 className="font-bold text-base" style={{ color: "var(--text-primary)" }}>
                {preset.title}
              </h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                {totalTopics} тем
              </p>
            </div>
          </div>

          {isAuth && (
            <div className="relative flex items-center justify-center" style={{ width: 52, height: 52 }}>
              <ProgressRing pct={pct} color={done ? "#10b981" : preset.color} />
              <span
                className="absolute text-[11px] font-bold"
                style={{ color: done ? "#10b981" : preset.color }}
              >
                {Math.round(pct * 100)}%
              </span>
            </div>
          )}
        </div>

        {/* Description */}
        <p className="text-xs mb-5" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
          {preset.description}
        </p>

        {/* Topic list */}
        <div className="flex flex-wrap gap-1.5 mb-5">
          {preset.topics.map((t) => {
            const p = progressMap.get(t.id);
            const isDone = p && p.total > 0 && p.completed >= p.total;
            const isStarted = p && p.completed > 0 && !isDone;
            return (
              <Link
                key={t.id}
                href={`/topic/${t.id}?track=school&depth=1`}
                className="text-[11px] px-2 py-1 rounded-lg transition-colors"
                style={{
                  background: isDone
                    ? "rgba(16,185,129,0.12)"
                    : isStarted
                    ? `${preset.color}18`
                    : "var(--bg-input)",
                  color: isDone
                    ? "#10b981"
                    : isStarted
                    ? preset.color
                    : "var(--text-muted)",
                  border: `1px solid ${isDone ? "rgba(16,185,129,0.25)" : isStarted ? `${preset.color}40` : "var(--border)"}`,
                }}
              >
                {isDone ? "✓ " : ""}{t.title}
              </Link>
            );
          })}
        </div>

        {/* Stats row */}
        {isAuth && (startedTopics > 0 || completedTopics > 0) && (
          <div className="flex items-center gap-4 mb-4 text-[11px]" style={{ color: "var(--text-muted)" }}>
            {completedTopics > 0 && (
              <span style={{ color: "#10b981" }}>
                ✓ {completedTopics} завершено
              </span>
            )}
            {startedTopics > completedTopics && (
              <span style={{ color: preset.color }}>
                ◑ {startedTopics - completedTopics} в процессе
              </span>
            )}
            <span>
              {totalTopics - startedTopics} не начато
            </span>
          </div>
        )}

        {/* Action button */}
        <Link
          href={`/topic/${nextTopic.id}?track=school&depth=1`}
          className="btn-primary w-full text-center text-sm block"
          style={done ? { background: "#10b981" } : {}}
        >
          {done
            ? "Повторить"
            : completedTopics > 0 || startedTopics > 0
            ? `Продолжить → ${nextTopic.title}`
            : `Начать → ${nextTopic.title}`}
        </Link>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function PresetsPage() {
  const { user } = useAuth();
  const isAuth = !!user;
  const [progressMap, setProgressMap] = useState<Map<string, ProgressSummaryItem>>(new Map());

  useEffect(() => {
    if (!isAuth) return;
    fetchProgressSummary()
      .then((items) => {
        setProgressMap(new Map(items.map((i) => [i.topicId, i])));
      })
      .catch(() => {});
  }, [isAuth]);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link
              href="/"
              className="text-xs mb-3 inline-flex items-center gap-1 transition-colors hover:text-[var(--accent)]"
              style={{ color: "var(--text-muted)" }}
            >
              ← На главную
            </Link>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
              Учебные треки
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Готовые программы подготовки с отслеживанием прогресса
            </p>
          </div>
        </div>

        {!isAuth && (
          <div
            className="rounded-xl p-4 mb-6 text-sm"
            style={{
              background: "var(--accent-subtle)",
              border: "1px solid var(--accent)",
              color: "var(--accent)",
            }}
          >
            <Link href="/auth" className="font-semibold hover:underline">Войдите</Link>
            <span style={{ color: "var(--text-secondary)" }}>
              {" "}чтобы отслеживать прогресс по трекам
            </span>
          </div>
        )}

        {/* Preset cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {PRESETS.map((preset) => (
            <PresetCard
              key={preset.id}
              preset={preset}
              progressMap={progressMap}
              isAuth={isAuth}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
