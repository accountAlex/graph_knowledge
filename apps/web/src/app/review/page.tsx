"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/providers/AuthProvider";
import { PageHeader } from "@/components/PageHeader";
import { MarkdownContent } from "@/features/graph-view/ui/MarkdownContent";
import { fetchDueReviews, submitReview, type DueReview } from "@/lib/progressApi";

const RATINGS = [
  { q: 2, label: "Снова", color: "var(--danger)" },
  { q: 3, label: "Трудно", color: "#f59e0b" },
  { q: 4, label: "Хорошо", color: "#38bdf8" },
  { q: 5, label: "Легко", color: "#34d399" },
];

const ROLE_LABEL: Record<string, string> = {
  TOPIC: "Тема", CONCEPT: "Понятие", METHOD: "Метод", SKILL: "Навык", TASK: "Задача",
};

type Phase = "loading" | "empty" | "review" | "done";

export default function ReviewPage() {
  const { user, loading: authLoading } = useAuth();
  const [phase, setPhase] = useState<Phase>("loading");
  const [cards, setCards] = useState<DueReview[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [reviewed, setReviewed] = useState(0);

  useEffect(() => {
    if (authLoading || !user) return;
    let active = true;
    fetchDueReviews(30)
      .then((d) => { if (active) { setCards(d); setPhase(d.length ? "review" : "empty"); } })
      .catch(() => active && setPhase("empty"));
    return () => { active = false; };
  }, [user, authLoading]);

  const card = cards[index];
  const showLogin = !authLoading && !user;

  const rate = (q: number) => {
    if (!card) return;
    submitReview(card.nodeId, q).catch(() => {});
    setReviewed((n) => n + 1);
    if (index + 1 < cards.length) {
      setIndex(index + 1);
      setRevealed(false);
    } else {
      setPhase("done");
    }
  };

  return (
    <main className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <PageHeader
        eyebrow="Интервальное повторение"
        title={<>Повторение <span style={{ color: "var(--accent)" }}>на сегодня</span></>}
        subtitle="Освежи то, что начинает забываться. Чем честнее оценка — тем умнее расписание."
      />

      <div className="mx-auto max-w-xl px-5 sm:px-6 py-10">
        {phase === "loading" && !showLogin && (
          <div className="py-16 flex justify-center">
            <div className="w-9 h-9 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
          </div>
        )}

        {(phase === "empty" || showLogin) && (
          <div className="text-center py-16">
            <div className="text-4xl mb-4">{user ? "✓" : "◎"}</div>
            <h2 className="font-display text-xl mb-2" style={{ fontWeight: 700, color: "var(--text-primary)" }}>
              {user ? "На сегодня всё повторено" : "Войдите, чтобы повторять"}
            </h2>
            <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
              {user ? "Освоенные темы появятся здесь, когда придёт время их освежить." : "Прогресс и расписание повторений привязаны к аккаунту."}
            </p>
            <Link href={user ? "/roadmap" : "/auth"} className="btn-primary">
              {user ? "Открыть граф знаний" : "Войти"}
            </Link>
          </div>
        )}

        {phase === "review" && card && (
          <div>
            {/* Progress */}
            <div className="flex items-center justify-between mb-4 text-xs" style={{ color: "var(--text-muted)" }}>
              <span>{index + 1} из {cards.length}</span>
              <span>Осталось: {cards.length - index}</span>
            </div>
            <div className="w-full h-1 rounded-full overflow-hidden mb-6" style={{ background: "var(--bg-input)" }}>
              <div className="h-full rounded-full transition-all duration-300" style={{ width: `${(index / cards.length) * 100}%`, background: "var(--accent)" }} />
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={card.nodeId}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -14 }}
                transition={{ duration: 0.25 }}
                className="rounded-2xl p-6 min-h-[220px] flex flex-col"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
              >
                {card.role && (
                  <span className="badge self-start mb-3" style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}>
                    {ROLE_LABEL[card.role] ?? card.role}
                  </span>
                )}
                <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>{card.title}</h3>

                {!revealed ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-4 py-6">
                    <p className="text-sm text-center" style={{ color: "var(--text-muted)" }}>Вспомни суть, затем проверь себя</p>
                    <button onClick={() => setRevealed(true)} className="btn-primary">Показать</button>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                      {card.description ? <MarkdownContent>{card.description}</MarkdownContent> : <span style={{ color: "var(--text-muted)" }}>Нет описания — оцени по памяти.</span>}
                    </div>
                    <div className="grid grid-cols-4 gap-2 mt-5">
                      {RATINGS.map((r) => (
                        <button
                          key={r.q}
                          onClick={() => rate(r.q)}
                          className="py-2.5 rounded-xl text-xs font-semibold transition-all hover:-translate-y-0.5"
                          style={{ background: `${r.color}1a`, color: r.color, border: `1px solid ${r.color}40` }}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        )}

        {phase === "done" && (
          <div className="text-center py-16">
            <div className="text-4xl mb-4">🎉</div>
            <h2 className="font-display text-2xl mb-2" style={{ fontWeight: 700, color: "var(--text-primary)" }}>
              Повторено {reviewed}
            </h2>
            <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
              Отличная работа. Следующие повторения — по расписанию.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link href="/roadmap" className="btn-primary">К графу знаний</Link>
              <Link href="/" className="btn-ghost">На главную</Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
