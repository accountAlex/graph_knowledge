"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fetchTopics, type TopicListItem } from "@/lib/topicsApi";
import { useAuth } from "@/providers/AuthProvider";
import { ChatButton } from "@/features/assistant/ui/ChatButton";
import { fetchProgressSummary, type ProgressSummaryItem } from "@/lib/progressApi";
import { GlobalSearch } from "@/features/search/ui/GlobalSearch";

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonCard({ index }: { index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.35 }}
      className="rounded-2xl overflow-hidden"
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
    </motion.div>
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
    return [...combined, ...combined];
  }, [topics]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden py-3 mb-10"
      style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}
    >
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
              style={{
                background: i % 4 === 0 ? "var(--accent)" : i % 4 === 1 ? "var(--role-concept)" : i % 4 === 2 ? "var(--role-method)" : "var(--role-skill)",
              }}
            />
            {item}
          </span>
        ))}
      </div>
    </motion.div>
  );
}

// ── Topic card ─────────────────────────────────────────────────────────────────
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
  const p = progressMap.get(topic.id);
  const pct = p && p.total > 0 ? Math.round((p.completed / p.total) * 100) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{
        duration: 0.5,
        delay: Math.min(idx % 6, 5) * 0.055,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <motion.div
        whileHover={{ y: -3, transition: { type: "spring", stiffness: 400, damping: 20 } }}
      >
        <Link
          href={`/topic/${topic.id}?track=${track}&depth=0`}
          className="glass-card group overflow-hidden block"
          style={{ transform: "none" }}
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
                  <motion.div
                    whileHover={{ scale: 1.5 }}
                    transition={{ type: "spring", stiffness: 400, damping: 15 }}
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: color, opacity: 0.6 }}
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
                  <motion.div
                    className="h-full rounded-full"
                    initial={{ width: 0 }}
                    whileInView={{ width: `${pct}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.7, ease: "easeOut", delay: 0.2 }}
                    style={{
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
              <motion.span
                className="text-xs font-medium"
                style={{ color: "var(--text-muted)" }}
                initial={{ x: 0 }}
                whileHover={{ x: 4 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
              >
                Explore &rarr;
              </motion.span>
            </div>
          </div>
        </Link>
      </motion.div>
    </motion.div>
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
        <motion.div
          className="text-center mb-10 sm:mb-14"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.4, ease: "easeOut" }}
            className="badge badge-accent inline-flex mb-4 sm:mb-5 text-xs tracking-widest uppercase"
          >
            Knowledge Graph
          </motion.div>

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

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35, duration: 0.5 }}
            className="mt-4 sm:mt-5 text-base sm:text-lg max-w-xl mx-auto leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            Многоуровневый граф знаний с зависимостями.
            <br className="hidden sm:inline" />
            Выбери тему и исследуй её структуру.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.45 }}
            className="mt-7 sm:mt-9 flex items-center justify-center gap-3 flex-wrap"
          >
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}>
              <Link href="/presets" className="btn-primary text-sm sm:text-base px-6 sm:px-8 py-2.5 sm:py-3 font-semibold">
                Выбрать трек
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}>
              <Link href="/roadmap" className="btn-ghost text-sm sm:text-base px-6 sm:px-8 py-2.5 sm:py-3 font-medium">
                Открыть Roadmap
              </Link>
            </motion.div>
            {user && (
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}>
                <Link href="/profile" className="btn-ghost text-sm sm:text-base px-5 py-2.5 font-medium">
                  Мой прогресс
                </Link>
              </motion.div>
            )}
          </motion.div>
        </motion.div>

        {/* ── Marquee ticker ── */}
        {!loading && items.length > 0 && <MarqueeTicker topics={items} />}

        {/* ── Search ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.4 }}
          className="max-w-lg mx-auto mb-10"
        >
          <GlobalSearch
            onQueryChange={setQ}
            placeholder="Поиск по всем темам, понятиям, методам..."
          />
        </motion.div>

        {/* ── Error ── */}
        <AnimatePresence>
          {err && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="rounded-xl p-4 text-sm max-w-md mx-auto mb-8"
              style={{
                background: "rgba(248,113,133,0.08)",
                color: "var(--danger)",
                border: "1px solid rgba(248,113,133,0.2)",
              }}
            >
              {err}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Skeleton ── */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[0, 1, 2, 3, 4, 5].map((i) => <SkeletonCard key={i} index={i} />)}
          </div>
        )}

        {/* ── Empty ── */}
        <AnimatePresence>
          {!loading && !err && filtered.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-24 text-center"
              style={{ color: "var(--text-muted)" }}
            >
              <div className="text-4xl mb-3">◯</div>
              Темы не найдены
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Cards ── */}
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
