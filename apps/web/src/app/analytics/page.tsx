"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import {
  fetchAnalyticsSummary,
  fetchAnalyticsActivity,
  fetchAnalyticsByRole,
  fetchAnalyticsTimeline,
  type AnalyticsSummary,
  type ActivityData,
  type RoleCount,
  type TimelineItem,
} from "@/lib/analyticsApi";

// ── Role metadata ────────────────────────────────────────────────────────────
const ROLE_META: Record<string, { label: string; color: string }> = {
  CONCEPT:  { label: "Концепт",   color: "var(--role-concept)"  },
  METHOD:   { label: "Метод",     color: "var(--role-method)"   },
  SKILL:    { label: "Навык",     color: "var(--role-skill)"    },
  TASK:     { label: "Задача",    color: "var(--role-task)"     },
  UNKNOWN:  { label: "Прочее",    color: "var(--text-muted)"    },
};

// ── Activity heatmap (90 days) ───────────────────────────────────────────────
function ActivityHeatmap({ activity }: { activity: Record<string, number> }) {
  // Build 90-day grid aligned to weeks (Sun-Sat)
  const today = new Date();
  const cells: { date: string; count: number }[] = [];

  for (let i = 89; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    cells.push({ date: key, count: activity[key] ?? 0 });
  }

  const max = Math.max(...cells.map((c) => c.count), 1);

  function cellColor(count: number) {
    if (count === 0) return "var(--bg-input)";
    const intensity = count / max;
    if (intensity < 0.25) return "rgba(99,102,241,0.25)";
    if (intensity < 0.5)  return "rgba(99,102,241,0.5)";
    if (intensity < 0.75) return "rgba(99,102,241,0.75)";
    return "var(--accent)";
  }

  // Pad front so grid starts on Sunday
  const firstDow = new Date(cells[0].date).getDay(); // 0=Sun
  const padded: (null | { date: string; count: number })[] = [
    ...Array(firstDow).fill(null),
    ...cells,
  ];

  const weeks: (null | { date: string; count: number })[][] = [];
  for (let i = 0; i < padded.length; i += 7) {
    weeks.push(padded.slice(i, i + 7));
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-1" style={{ minWidth: "fit-content" }}>
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((cell, di) =>
              cell === null ? (
                <div key={di} className="w-3.5 h-3.5" />
              ) : (
                <div
                  key={di}
                  className="w-3.5 h-3.5 rounded-sm transition-colors"
                  style={{ background: cellColor(cell.count) }}
                  title={`${cell.date}: ${cell.count} выполнено`}
                />
              )
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-2">
        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Меньше</span>
        {[0, 0.3, 0.6, 0.9, 1].map((v, i) => (
          <div
            key={i}
            className="w-3 h-3 rounded-sm"
            style={{ background: cellColor(v * max) }}
          />
        ))}
        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Больше</span>
      </div>
    </div>
  );
}

// ── Role breakdown bar ───────────────────────────────────────────────────────
function RoleBreakdown({ data }: { data: RoleCount[] }) {
  const total = data.reduce((s, r) => s + r.count, 0);
  if (total === 0) return (
    <p className="text-sm" style={{ color: "var(--text-muted)" }}>Нет данных</p>
  );

  return (
    <div className="space-y-3">
      {data.sort((a, b) => b.count - a.count).map(({ role, count }) => {
        const meta = ROLE_META[role] ?? ROLE_META.UNKNOWN;
        const pct = Math.round((count / total) * 100);
        return (
          <div key={role}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium">{meta.label}</span>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {count} ({pct}%)
              </span>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-input)" }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, background: meta.color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Timeline ─────────────────────────────────────────────────────────────────
function Timeline({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) return (
    <p className="text-sm" style={{ color: "var(--text-muted)" }}>Нет завершённых элементов</p>
  );

  return (
    <ol className="relative space-y-0" style={{ borderLeft: "2px solid var(--border)" }}>
      {items.map((item, i) => {
        const meta = ROLE_META[item.role ?? "UNKNOWN"] ?? ROLE_META.UNKNOWN;
        const dt = new Date(item.completedAt);
        return (
          <li key={`${item.nodeId}-${i}`} className="pl-5 pb-4 relative">
            <span
              className="absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 flex items-center justify-center"
              style={{
                background: "var(--bg-card)",
                borderColor: meta.color,
              }}
            />
            <div className="text-sm font-medium">{item.title}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className="badge text-[10px]"
                style={{ background: `${meta.color}20`, color: meta.color }}
              >
                {meta.label}
              </span>
              <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                {dt.toLocaleDateString("ru-RU", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ value, label, icon }: { value: number | string; label: string; icon: string }) {
  return (
    <div
      className="rounded-2xl p-5 flex items-center gap-4"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
        style={{ background: "var(--accent-subtle)" }}
      >
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{label}</div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [activityData, setActivityData] = useState<ActivityData | null>(null);
  const [byRole, setByRole] = useState<RoleCount[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/auth");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      fetchAnalyticsSummary().catch(() => null),
      fetchAnalyticsActivity().catch(() => null),
      fetchAnalyticsByRole().catch(() => []),
      fetchAnalyticsTimeline().catch(() => []),
    ]).then(([sum, act, roles, tl]) => {
      setSummary(sum);
      setActivityData(act);
      setByRole(roles as RoleCount[]);
      setTimeline(tl as TimelineItem[]);
      setLoading(false);
    });
  }, [user]);

  if (authLoading || !user) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
        <div
          className="w-10 h-10 rounded-full border-2 border-t-transparent"
          style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)", animation: "spin-slow 1s linear infinite" }}
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-30"
        style={{
          background: "var(--bg-glass)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="mx-auto max-w-4xl px-6 py-3.5 flex items-center gap-4">
          <Link href="/profile" className="btn-ghost text-xs flex items-center gap-2">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Профиль
          </Link>
          <h1 className="text-base font-semibold">Аналитика обучения</h1>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-24 rounded-2xl" style={{ animationDelay: `${i * 80}ms` }} />
            ))}
          </div>
        ) : (
          <>
            {/* ── Summary stats ── */}
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in-up">
              <StatCard
                value={summary?.completedCount ?? 0}
                label="Элементов изучено"
                icon="✓"
              />
              <StatCard
                value={activityData?.currentStreak ?? 0}
                label={`дн. подряд (макс. ${activityData?.maxStreak ?? 0})`}
                icon="▲"
              />
              <StatCard
                value={summary?.activeDays ?? 0}
                label="Активных дней"
                icon="📅"
              />
            </section>

            {/* ── Activity heatmap ── */}
            <section
              className="rounded-2xl p-5 sm:p-6 animate-fade-in delay-1"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
            >
              <h2 className="text-sm font-semibold mb-4">Активность за 90 дней</h2>
              {activityData ? (
                <ActivityHeatmap activity={activityData.activity} />
              ) : (
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>Нет данных</p>
              )}
            </section>

            {/* ── Role breakdown + Timeline (2-col on md+) ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Role breakdown */}
              <section
                className="rounded-2xl p-5 sm:p-6 animate-fade-in delay-2"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
              >
                <h2 className="text-sm font-semibold mb-4">По типу элемента</h2>
                <RoleBreakdown data={byRole} />
              </section>

              {/* Timeline */}
              <section
                className="rounded-2xl p-5 sm:p-6 animate-fade-in delay-3"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
              >
                <h2 className="text-sm font-semibold mb-4">Последние изученные</h2>
                <Timeline items={timeline} />
              </section>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
