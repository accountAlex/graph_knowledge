"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/providers/AuthProvider";
import { fetchProgressSummary, type ProgressSummaryItem } from "@/lib/progressApi";
import { PRESETS, type Preset } from "@/lib/presets";
import { PageHeader } from "@/components/PageHeader";

// ── Progress ring SVG ─────────────────────────────────────────────────────────
function ProgressRing({ pct, color, size = 56 }: { pct: number; color: string; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-input)" strokeWidth={5} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={5}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.7s cubic-bezier(0.22,1,0.36,1)" }}
      />
    </svg>
  );
}

// ── Single preset card ────────────────────────────────────────────────────────
function PresetCard({
  preset,
  progressMap,
  isAuth,
  index,
}: {
  preset: Preset;
  progressMap: Map<string, ProgressSummaryItem>;
  isAuth: boolean;
  index: number;
}) {
  const totalTopics = preset.topics.length;
  const completedTopics = preset.topics.filter((t) => {
    const p = progressMap.get(t.id);
    return p && p.total > 0 && p.completed >= p.total;
  }).length;
  const startedTopics = preset.topics.filter((t) => {
    const p = progressMap.get(t.id);
    return p && p.completed > 0;
  }).length;
  const pct = totalTopics > 0 ? completedTopics / totalTopics : 0;
  const nextTopic =
    preset.topics.find((t) => {
      const p = progressMap.get(t.id);
      return !p || p.total === 0 || p.completed < p.total;
    }) ?? preset.topics[0];
  const done = completedTopics === totalTopics;

  return (
    <div
      className="group rounded-2xl overflow-hidden animate-card-reveal flex flex-col"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)", animationDelay: `${index * 70}ms` }}
    >
      <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${preset.color}, transparent)` }} />

      <div className="p-6 flex flex-col flex-1">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <span
              className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
              style={{ background: `${preset.color}1a` }}
            >
              {preset.icon}
            </span>
            <div>
              <h2 className="font-display text-base" style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                {preset.title}
              </h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{totalTopics} тем</p>
            </div>
          </div>

          {isAuth && (
            <div className="relative flex items-center justify-center shrink-0" style={{ width: 56, height: 56 }}>
              <ProgressRing pct={pct} color={done ? "var(--success)" : preset.color} />
              <span className="absolute text-[11px] font-bold" style={{ color: done ? "var(--success)" : preset.color }}>
                {Math.round(pct * 100)}%
              </span>
            </div>
          )}
        </div>

        <p className="text-xs mb-5" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
          {preset.description}
        </p>

        {/* Topic chips */}
        <div className="flex flex-wrap gap-1.5 mb-5">
          {preset.topics.map((t) => {
            const p = progressMap.get(t.id);
            const isDone = p && p.total > 0 && p.completed >= p.total;
            const isStarted = p && p.completed > 0 && !isDone;
            return (
              <Link
                key={t.id}
                href={`/topic/${t.id}?track=school&depth=1`}
                className="text-[11px] px-2.5 py-1 rounded-full transition-all hover:-translate-y-0.5"
                style={{
                  background: isDone ? "var(--success)20" : isStarted ? `${preset.color}18` : "var(--bg-input)",
                  color: isDone ? "var(--success)" : isStarted ? preset.color : "var(--text-muted)",
                  border: `1px solid ${isDone ? "var(--success)40" : isStarted ? `${preset.color}40` : "var(--border)"}`,
                }}
              >
                {isDone ? "✓ " : ""}{t.title}
              </Link>
            );
          })}
        </div>

        {/* Stats */}
        {isAuth && (startedTopics > 0 || completedTopics > 0) && (
          <div className="flex items-center gap-4 mb-4 text-[11px]" style={{ color: "var(--text-muted)" }}>
            {completedTopics > 0 && <span style={{ color: "var(--success)" }}>✓ {completedTopics} завершено</span>}
            {startedTopics > completedTopics && (
              <span style={{ color: preset.color }}>◑ {startedTopics - completedTopics} в процессе</span>
            )}
            <span>{totalTopics - startedTopics} не начато</span>
          </div>
        )}

        {/* Action */}
        <Link
          href={`/topic/${nextTopic.id}?track=school&depth=1`}
          className="btn-primary w-full text-center text-sm block mt-auto"
          style={done ? { background: "var(--success)" } : {}}
        >
          {done ? "Повторить" : completedTopics > 0 || startedTopics > 0 ? `Продолжить → ${nextTopic.title}` : `Начать → ${nextTopic.title}`}
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
      .then((items) => setProgressMap(new Map(items.map((i) => [i.topicId, i]))))
      .catch(() => {});
  }, [isAuth]);

  return (
    <main className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <PageHeader
        eyebrow="Программы подготовки"
        title={
          <>
            Готовые <span style={{ color: "var(--accent)" }}>учебные треки</span>
          </>
        }
        subtitle="Подобранные программы под ОГЭ, ЕГЭ и углублённую математику — с отслеживанием прогресса по графу знаний."
      />

      <div className="mx-auto max-w-6xl px-5 sm:px-6 py-10">
        {!isAuth && (
          <div
            className="rounded-2xl p-4 mb-7 text-sm flex items-center gap-2"
            style={{ background: "var(--accent-subtle)", border: "1px solid var(--border-glow)" }}
          >
            <Link href="/auth" className="font-semibold hover:underline" style={{ color: "var(--accent)" }}>Войдите</Link>
            <span style={{ color: "var(--text-secondary)" }}>чтобы отслеживать прогресс по трекам</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {PRESETS.map((preset, i) => (
            <PresetCard key={preset.id} preset={preset} progressMap={progressMap} isAuth={isAuth} index={i} />
          ))}
        </div>
      </div>
    </main>
  );
}
