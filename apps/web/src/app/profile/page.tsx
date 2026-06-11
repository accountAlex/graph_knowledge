"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme, THEME_LIST } from "@/providers/ThemeProvider";
import { ThemePicker } from "@/features/settings/ui/ThemePicker";
import { fetchProgressSummary, type ProgressSummaryItem } from "@/lib/progressApi";
import { fetchTopics, type TopicListItem } from "@/lib/topicsApi";
import { listSessions, deleteSession, type ChatSessionSummary } from "@/lib/assistantApi";
import { apiUpdateProfile } from "@/lib/authApi";
import { PRESETS } from "@/lib/presets";

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  USER: "Ученик", COMPOSER: "Составитель", ADMIN: "Администратор",
};

const AVATAR_COLORS = [
  "linear-gradient(135deg, #2f6fff, #5b8cff)",
  "linear-gradient(135deg, #0ea5e9, #2f6fff)",
  "linear-gradient(135deg, #10b981, #0ea5e9)",
  "linear-gradient(135deg, #f59e0b, #ef4444)",
  "linear-gradient(135deg, #8b5cf6, #6366f1)",
  "linear-gradient(135deg, #14b8a6, #10b981)",
];

type Tab = "progress" | "achievements" | "chats" | "settings";

// ── Achievements ──────────────────────────────────────────────────────────────

type Achievement = {
  id: string;
  icon: string;
  title: string;
  description: string;
  unlocked: boolean;
};

function computeAchievements(
  progress: ProgressSummaryItem[],
  sessions: ChatSessionSummary[],
): Achievement[] {
  const completedTopics = progress.filter((p) => p.total > 0 && p.completed >= p.total).length;
  const totalCompleted = progress.reduce((s, p) => s + p.completed, 0);
  const startedTopics = progress.filter((p) => p.completed > 0).length;

  return [
    {
      id: "first_step",
      icon: "◦",
      title: "Первые шаги",
      description: "Отметить первый элемент как изученный",
      unlocked: totalCompleted >= 1,
    },
    {
      id: "topic_done",
      icon: "◉",
      title: "Тема освоена",
      description: "Полностью пройти одну тему",
      unlocked: completedTopics >= 1,
    },
    {
      id: "five_topics",
      icon: "▲",
      title: "На разгоне",
      description: "Полностью пройти 5 тем",
      unlocked: completedTopics >= 5,
    },
    {
      id: "ten_topics",
      icon: "★",
      title: "Знаток",
      description: "Полностью пройти 10 тем",
      unlocked: completedTopics >= 10,
    },
    {
      id: "explorer",
      icon: "◎",
      title: "Исследователь",
      description: "Начать изучение 5 разных тем",
      unlocked: startedTopics >= 5,
    },
    {
      id: "fifty_nodes",
      icon: "↑",
      title: "Поглотитель знаний",
      description: "Изучить 50 элементов",
      unlocked: totalCompleted >= 50,
    },
    {
      id: "ai_chat",
      icon: "◆",
      title: "Первый диалог",
      description: "Использовать AI-ассистента",
      unlocked: sessions.length >= 1,
    },
    {
      id: "ai_power",
      icon: "◈",
      title: "AI-ученик",
      description: "Провести 5 чатов с AI",
      unlocked: sessions.length >= 5,
    },
  ];
}

// ── Preset progress row ───────────────────────────────────────────────────────

function PresetProgress({ progressMap }: { progressMap: Map<string, ProgressSummaryItem> }) {
  return (
    <div className="space-y-3">
      {PRESETS.map((preset) => {
        const total = preset.topics.length;
        const done = preset.topics.filter((t) => {
          const p = progressMap.get(t.id);
          return p && p.total > 0 && p.completed >= p.total;
        }).length;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        return (
          <div key={preset.id} className="rounded-xl p-3.5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span>{preset.icon}</span>
                <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{preset.title}</span>
              </div>
              <span className="text-xs font-bold" style={{ color: pct === 100 ? "#10b981" : preset.color }}>
                {done}/{total}
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-input)" }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${pct}%`,
                  background: pct === 100 ? "linear-gradient(90deg,#10b981,#34d399)" : preset.color,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout, loading: authLoading, refreshUser } = useAuth();
  const { theme } = useTheme();
  const [tab, setTab] = useState<Tab>("progress");
  const [progress, setProgress] = useState<ProgressSummaryItem[]>([]);
  const [topics, setTopics] = useState<TopicListItem[]>([]);
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Name editing
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Avatar color
  const [avatarColorIdx, setAvatarColorIdx] = useState(() => {
    if (typeof window === "undefined") return 0;
    return Number(localStorage.getItem("mg-avatar-color") ?? 0);
  });

  useEffect(() => {
    if (!authLoading && !user) router.replace("/auth");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    setNameValue(user.name ?? "");
    setLoading(true);
    Promise.all([
      fetchProgressSummary().catch(() => [] as ProgressSummaryItem[]),
      fetchTopics({ track: "school" }).catch(() => [] as TopicListItem[]),
    ]).then(([prog, top]) => { setProgress(prog); setTopics(top); setLoading(false); });
  }, [user]);

  useEffect(() => {
    if (tab !== "chats" || !user) return;
    listSessions().then(setSessions).catch(() => setSessions([]));
  }, [tab, user]);

  useEffect(() => {
    if (editingName && nameInputRef.current) nameInputRef.current.focus();
  }, [editingName]);

  const topicMap = useMemo(() => new Map(topics.map((t) => [t.id, t.title])), [topics]);
  const progressMap = useMemo(() => new Map(progress.map((p) => [p.topicId, p])), [progress]);
  const totalCompleted = useMemo(() => progress.reduce((s, p) => s + p.completed, 0), [progress]);
  const totalNodes = useMemo(() => progress.reduce((s, p) => s + p.total, 0), [progress]);
  const overallPct = totalNodes > 0 ? Math.round((totalCompleted / totalNodes) * 100) : 0;
  const achievements = useMemo(() => computeAchievements(progress, sessions), [progress, sessions]);
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  const handleSaveName = async () => {
    if (!user) return;
    setNameSaving(true);
    try {
      await apiUpdateProfile(nameValue);
      await refreshUser?.();
      setEditingName(false);
    } catch { /* ignore */ } finally {
      setNameSaving(false);
    }
  };

  const handleAvatarColor = (idx: number) => {
    setAvatarColorIdx(idx);
    localStorage.setItem("mg-avatar-color", String(idx));
  };

  if (authLoading || !user) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
        <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }} />
      </main>
    );
  }

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: "progress",     label: "Прогресс" },
    { id: "achievements", label: "Достижения", count: unlockedCount },
    { id: "chats",        label: "Чаты",       count: sessions.length || undefined },
    { id: "settings",     label: "Настройки" },
  ];

  return (
    <main className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 sm:py-10">

        {/* ── User card ── */}
        <div className="glass-card p-6 sm:p-8 mb-6 animate-fade-in-up !transform-none">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">

            {/* Avatar */}
            <div className="relative shrink-0">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold"
                style={{ background: AVATAR_COLORS[avatarColorIdx], color: "#fff", boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}
              >
                {(user.name?.[0] || user.email[0]).toUpperCase()}
              </div>
              {/* Color picker dots */}
              <div className="absolute -bottom-2 left-0 right-0 flex justify-center gap-1">
                {AVATAR_COLORS.map((c, i) => (
                  <button
                    key={i}
                    onClick={() => handleAvatarColor(i)}
                    className="w-2.5 h-2.5 rounded-full transition-transform hover:scale-125"
                    style={{ background: c.match(/#[\da-f]{6}/i)?.[0] ?? "#2f6fff", outline: i === avatarColorIdx ? "2px solid var(--accent)" : "none", outlineOffset: 1 }}
                  />
                ))}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 mt-3 sm:mt-0">
              {/* Name row */}
              <div className="flex items-center gap-2 mb-1">
                {editingName ? (
                  <div className="flex items-center gap-2">
                    <input
                      ref={nameInputRef}
                      value={nameValue}
                      onChange={(e) => setNameValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(); if (e.key === "Escape") setEditingName(false); }}
                      className="input-field text-sm font-bold h-8 px-2 w-40"
                      maxLength={80}
                    />
                    <button onClick={handleSaveName} disabled={nameSaving} className="btn-primary text-xs px-2.5 py-1 disabled:opacity-40">
                      {nameSaving ? "..." : "✓"}
                    </button>
                    <button onClick={() => setEditingName(false)} className="btn-ghost text-xs px-2 py-1">✕</button>
                  </div>
                ) : (
                  <>
                    <span className="font-display text-lg" style={{ fontWeight: 700 }}>{user.name || "Без имени"}</span>
                    <button
                      onClick={() => { setNameValue(user.name ?? ""); setEditingName(true); }}
                      className="text-[11px] px-2 py-0.5 rounded-lg transition-colors hover:bg-[var(--bg-card)]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      ✎
                    </button>
                  </>
                )}
              </div>
              <div className="text-sm mb-2" style={{ color: "var(--text-secondary)" }}>{user.email}</div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="badge" style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}>
                  {ROLE_LABELS[user.role] ?? user.role}
                </span>
                {totalNodes > 0 && (
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {totalCompleted} / {totalNodes} элементов изучено
                  </span>
                )}
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  ★ {unlockedCount}/{achievements.length} достижений
                </span>
              </div>
            </div>

            {/* Progress ring */}
            {totalNodes > 0 && (
              <div className="shrink-0 relative w-20 h-20 hidden sm:block">
                <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="var(--border)" strokeWidth="6" />
                  <circle cx="40" cy="40" r="34" fill="none"
                    stroke={overallPct === 100 ? "#10b981" : "var(--accent)"}
                    strokeWidth="6" strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 34}`}
                    strokeDashoffset={`${2 * Math.PI * 34 * (1 - overallPct / 100)}`}
                    style={{ transition: "stroke-dashoffset 0.8s ease" }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-bold" style={{ color: overallPct === 100 ? "#10b981" : "var(--accent)" }}>
                    {overallPct}%
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
          {TABS.map(({ id, label, count }) => (
            <button key={id} onClick={() => setTab(id)}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap flex items-center gap-1.5"
              style={{
                background: tab === id ? "var(--accent-subtle)" : "transparent",
                color: tab === id ? "var(--accent)" : "var(--text-muted)",
                border: tab === id ? "1px solid var(--accent)" : "1px solid transparent",
              }}
            >
              {label}
              {count !== undefined && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: tab === id ? "var(--accent)" : "var(--bg-input)", color: tab === id ? "#fff" : "var(--text-muted)" }}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Progress tab ── */}
        {tab === "progress" && (
          <div className="space-y-5 animate-fade-in">
            {/* Preset progress */}
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider mb-3 px-1" style={{ color: "var(--text-muted)" }}>
                Прогресс по трекам
              </div>
              <PresetProgress progressMap={progressMap} />
            </div>

            {/* Per-topic */}
            {!loading && progress.length > 0 && (
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider mb-3 px-1" style={{ color: "var(--text-muted)" }}>
                  По темам
                </div>
                <div className="space-y-2">
                  {progress.map((p) => {
                    const pct = p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0;
                    const title = topicMap.get(p.topicId) ?? p.topicId;
                    const isDone = pct === 100;
                    return (
                      <Link key={p.topicId} href={`/topic/${p.topicId}?track=school&depth=0`}
                        className="block rounded-xl p-3.5 transition-all hover:border-[var(--accent)]"
                        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium">{title}</span>
                          <span className="text-xs font-bold" style={{ color: isDone ? "#10b981" : "var(--accent)" }}>{pct}%</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-input)" }}>
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, background: isDone ? "linear-gradient(90deg,#10b981,#34d399)" : "linear-gradient(90deg,var(--accent),var(--accent-hover))" }} />
                        </div>
                        <div className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>{p.completed}/{p.total}</div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {!loading && progress.length === 0 && (
              <div className="py-16 text-center rounded-2xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <div className="text-3xl mb-3">◈</div>
                <div className="text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Пока нет прогресса</div>
                <div className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>Откройте тему и начните отмечать изученные элементы</div>
                <Link href="/" className="btn-primary text-xs">К темам</Link>
              </div>
            )}
          </div>
        )}

        {/* ── Achievements tab ── */}
        {tab === "achievements" && (
          <div className="animate-fade-in">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {achievements.map((a) => (
                <div key={a.id}
                  className="rounded-2xl p-4 flex flex-col items-center text-center transition-all"
                  style={{
                    background: a.unlocked ? "var(--accent-subtle)" : "var(--bg-card)",
                    border: `1px solid ${a.unlocked ? "var(--accent)" : "var(--border)"}`,
                    opacity: a.unlocked ? 1 : 0.45,
                  }}
                >
                  <span className="text-3xl mb-2">{a.icon}</span>
                  <div className="text-xs font-semibold mb-1" style={{ color: a.unlocked ? "var(--accent)" : "var(--text-secondary)" }}>
                    {a.title}
                  </div>
                  <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>{a.description}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Chats tab ── */}
        {tab === "chats" && (
          <div className="space-y-3 animate-fade-in">
            {sessions.length === 0 ? (
              <div className="py-16 text-center rounded-2xl" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <div className="text-3xl mb-3">◇</div>
                <div className="text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Нет сохранённых чатов</div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>Начните диалог с AI-ассистентом на странице темы</div>
              </div>
            ) : (
              sessions.map((s) => (
                <div key={s.id} className="rounded-2xl p-4 flex items-center justify-between gap-4"
                  style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm truncate">{s.title}</div>
                    <div className="flex items-center gap-2 mt-1">
                      {s.topicId && topicMap.get(s.topicId) && (
                        <span className="badge badge-accent text-[10px]">{topicMap.get(s.topicId)}</span>
                      )}
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {new Date(s.updatedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => deleteSession(s.id).then(() => setSessions((p) => p.filter((x) => x.id !== s.id)))}
                    className="btn-ghost !p-2 shrink-0" style={{ color: "var(--danger)" }}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── Settings tab ── */}
        {tab === "settings" && (
          <div className="space-y-4 animate-fade-in">
            <div className="rounded-2xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <div className="text-sm font-semibold mb-3">Тема оформления</div>
              <div className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
                Текущая: {THEME_LIST.find((t) => t.id === theme)?.label}
              </div>
              <ThemePicker />
            </div>
            <div className="rounded-2xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <div className="text-sm font-semibold mb-4">Аккаунт</div>
              <div className="space-y-3 text-sm">
                {[["Email", user.email], ["Роль", ROLE_LABELS[user.role] ?? user.role]].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>{k}</span>
                    <span>{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={() => { logout(); router.push("/"); }}
              className="w-full rounded-2xl p-4 text-sm font-semibold transition-all hover:brightness-110"
              style={{ background: "rgba(248,113,113,0.08)", color: "var(--danger)", border: "1px solid rgba(248,113,113,0.2)" }}
            >
              Выйти из аккаунта
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
