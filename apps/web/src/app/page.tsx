"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchTopics, type TopicListItem } from "@/lib/topicsApi";
import { useAuth } from "@/providers/AuthProvider";
import { ChatButton } from "@/features/assistant/ui/ChatButton";
import { fetchProgressSummary, type ProgressSummaryItem } from "@/lib/progressApi";
import { GlobalSearch } from "@/features/search/ui/GlobalSearch";

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonCard({ index }: { index: number }) {
  return (
    <div
      className={`rounded-2xl overflow-hidden animate-fade-in delay-${index + 1}`}
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      <div className="skeleton h-1.5 w-full" />
      <div className="p-5 space-y-4">
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton w-3 h-3 rounded-full" />
          ))}
        </div>
        <div className="skeleton h-5 w-3/4" />
        <div className="flex justify-between items-center">
          <div className="skeleton h-5 w-20" />
          <div className="skeleton h-4 w-16" />
        </div>
      </div>
    </div>
  );
}

const ROLE_COLORS = [
  "var(--role-topic)",
  "var(--role-concept)",
  "var(--role-method)",
  "var(--role-skill)",
  "var(--role-task)",
];

// ── Typing animation hook ─────────────────────────────────────────────────────
function useTypingText(fullText: string, speed = 55, startDelay = 400) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed("");
    setDone(false);
    let i = 0;
    const timer = setTimeout(() => {
      const interval = setInterval(() => {
        i++;
        setDisplayed(fullText.slice(0, i));
        if (i >= fullText.length) {
          clearInterval(interval);
          setDone(true);
        }
      }, speed);
      return () => clearInterval(interval);
    }, startDelay);
    return () => clearTimeout(timer);
  }, [fullText, speed, startDelay]);

  return { displayed, done };
}

// ── Scroll reveal hook ────────────────────────────────────────────────────────
function useScrollReveal(deps: unknown[] = []) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.08 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ref, visible };
}

// ── Marquee ticker ────────────────────────────────────────────────────────────
const STATIC_ITEMS = [
  "544 узла", "275 зависимостей", "39 тем ЕГЭ 2026",
  "Квадратные уравнения", "Тригонометрия", "Производная",
  "Интеграл", "Логарифмы", "Теория вероятностей",
  "Комбинаторика", "Планиметрия", "Системы уравнений",
];

function MarqueeTicker({ topics }: { topics: TopicListItem[] }) {
  const items = useMemo(() => {
    const topicNames = topics.slice(0, 20).map((t) => t.title);
    const combined = [...STATIC_ITEMS.slice(0, 6), ...topicNames, ...STATIC_ITEMS.slice(6)];
    // duplicate for seamless loop
    return [...combined, ...combined];
  }, [topics]);

  return (
    <div
      className="relative overflow-hidden py-3 mb-10"
      style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}
    >
      {/* Fade masks */}
      <div
        className="absolute left-0 top-0 bottom-0 w-16 z-10 pointer-events-none"
        style={{ background: "linear-gradient(90deg, var(--bg-primary), transparent)" }}
      />
      <div
        className="absolute right-0 top-0 bottom-0 w-16 z-10 pointer-events-none"
        style={{ background: "linear-gradient(270deg, var(--bg-primary), transparent)" }}
      />

      <div className="flex animate-marquee whitespace-nowrap" style={{ willChange: "transform" }}>
        {items.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-3 px-4 text-xs font-medium" style={{ color: "var(--text-muted)" }}>
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: i % 4 === 0 ? "var(--accent)" : i % 4 === 1 ? "var(--role-concept)" : i % 4 === 2 ? "var(--role-method)" : "var(--role-skill)" }}
            />
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Topic card with scroll reveal ─────────────────────────────────────────────
function TopicCard({
  topic,
  idx,
  track,
  progressMap,
}: {
  topic: TopicListItem;
  idx: number;
  track: string;
  progressMap: Map<string, ProgressSummaryItem>;
}) {
  const { ref, visible } = useScrollReveal([topic.id]);
  const p = progressMap.get(topic.id);
  const pct = p && p.total > 0 ? Math.round((p.completed / p.total) * 100) : null;

  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? undefined : 0,
        animation: visible ? `card-reveal 0.5s cubic-bezier(0.22, 1, 0.36, 1) ${Math.min(idx % 6, 5) * 60}ms both` : "none",
      }}
    >
      <Link
        href={`/topic/${topic.id}?track=${track}&depth=0`}
        className="glass-card group overflow-hidden block"
      >
        {/* Accent bar */}
        <div
          className="h-[3px] w-full opacity-40 group-hover:opacity-100 transition-opacity duration-300"
          style={{ background: "linear-gradient(90deg, var(--role-topic), var(--accent))" }}
        />

        <div className="p-5">
          {/* Mini roadmap dots */}
          <div className="flex items-center gap-1.5 mb-4">
            {ROLE_COLORS.map((color, i) => (
              <div key={i} className="flex items-center gap-1">
                <div
                  className="w-2.5 h-2.5 rounded-full transition-transform duration-300 group-hover:scale-125"
                  style={{ background: color, opacity: 0.6, transitionDelay: `${i * 40}ms` }}
                />
                {i < 4 && (
                  <div className="w-4 h-px" style={{ background: "var(--border)" }} />
                )}
              </div>
            ))}
          </div>

          <h3 className="text-base font-semibold leading-snug transition-colors duration-200 group-hover:text-[var(--accent)]">
            {topic.title}
          </h3>

          {/* Progress bar */}
          {pct !== null && (
            <div className="mt-3 mb-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Прогресс</span>
                <span className="text-[10px] font-semibold" style={{ color: pct === 100 ? "#10b981" : "var(--accent)" }}>
                  {p!.completed}/{p!.total}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-input)" }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    background: pct === 100
                      ? "linear-gradient(90deg, #10b981, #34d399)"
                      : "linear-gradient(90deg, var(--accent), var(--accent-hover))",
                  }}
                />
              </div>
            </div>
          )}

          <div className="mt-3 flex items-center justify-between">
            <span className="badge badge-accent">Roadmap</span>
            <span
              className="text-xs font-medium transition-all duration-200 group-hover:translate-x-1"
              style={{ color: "var(--text-muted)" }}
            >
              Explore &rarr;
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function HomePage() {
  const { user } = useAuth();
  const [track] = useState("school");
  const [items, setItems] = useState<TopicListItem[]>([]);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [progressMap, setProgressMap] = useState<Map<string, ProgressSummaryItem>>(new Map());

  const { displayed, done } = useTypingText("структурированно", 55, 500);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setErr(null);
    fetchTopics({ track, signal: ac.signal })
      .then(setItems)
      .catch((e) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        if (e?.message?.includes("aborted")) return;
        setErr(e instanceof Error ? e.message : "Unknown error");
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [track]);

  useEffect(() => {
    if (!user) return;
    fetchProgressSummary()
      .then((items) => setProgressMap(new Map(items.map((i) => [i.topicId, i]))))
      .catch(() => {});
  }, [user]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((t) => t.title.toLowerCase().includes(s) || t.id.includes(s));
  }, [items, q]);

  return (
    <main className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-12 sm:pt-20 pb-16 sm:pb-24">

        {/* ── Hero ── */}
        <div className="text-center mb-10 sm:mb-14 animate-fade-in-up">
          <div className="badge badge-accent inline-flex mb-4 sm:mb-5 text-xs tracking-widest uppercase">
            Knowledge Graph
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-tight">
            Изучай математику
            <br />
            <span
              className={!done ? "cursor-blink" : ""}
              style={{
                background: "linear-gradient(135deg, var(--accent), var(--accent-hover))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                display: "inline-block",
                minWidth: "4px",
              }}
            >
              {displayed}
            </span>
          </h1>

          <p
            className="mt-4 sm:mt-5 text-base sm:text-lg max-w-xl mx-auto leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            Многоуровневый граф знаний с зависимостями.
            <br className="hidden sm:inline" />
            Выбери тему и исследуй её структуру.
          </p>

          <div className="mt-7 sm:mt-9 flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/presets"
              className="btn-primary text-sm sm:text-base px-6 sm:px-8 py-2.5 sm:py-3 font-semibold"
            >
              Выбрать трек
            </Link>
            <Link
              href="/roadmap"
              className="btn-ghost text-sm sm:text-base px-6 sm:px-8 py-2.5 sm:py-3 font-medium"
            >
              Открыть Roadmap
            </Link>
            {user && (
              <Link
                href="/profile"
                className="btn-ghost text-sm sm:text-base px-5 py-2.5 font-medium"
              >
                Мой прогресс
              </Link>
            )}
          </div>
        </div>

        {/* ── Marquee ticker ── */}
        {!loading && items.length > 0 && <MarqueeTicker topics={items} />}

        {/* ── Search ── */}
        <div className="max-w-lg mx-auto mb-10 animate-fade-in delay-2">
          <GlobalSearch
            onQueryChange={setQ}
            placeholder="Поиск по всем темам, понятиям, методам..."
          />
        </div>

        {/* ── Error ── */}
        {err && (
          <div
            className="rounded-xl p-4 text-sm max-w-md mx-auto mb-8 animate-fade-in-scale"
            style={{
              background: "rgba(248,113,133,0.08)",
              color: "var(--danger)",
              border: "1px solid rgba(248,113,133,0.2)",
            }}
          >
            {err}
          </div>
        )}

        {/* ── Skeleton ── */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[0, 1, 2, 3, 4, 5].map((i) => <SkeletonCard key={i} index={i} />)}
          </div>
        )}

        {/* ── Empty ── */}
        {!loading && !err && filtered.length === 0 && (
          <div className="py-24 text-center animate-fade-in" style={{ color: "var(--text-muted)" }}>
            <div className="text-4xl mb-3">◯</div>
            Темы не найдены
          </div>
        )}

        {/* ── Cards with scroll reveal ── */}
        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((t, idx) => (
              <TopicCard
                key={t.id}
                topic={t}
                idx={idx}
                track={track}
                progressMap={progressMap}
              />
            ))}
          </div>
        )}
      </div>

      <ChatButton />
    </main>
  );
}
