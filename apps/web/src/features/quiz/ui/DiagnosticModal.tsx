"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  fetchDiagnostic,
  submitDiagnostic,
  type DiagnosticQuestion,
  type DiagnosticResult,
} from "@/lib/quizApi";
import type { MasteryLevel } from "@mathgraph/shared";

const MASTERY: Record<MasteryLevel, { color: string; label: string }> = {
  UNSEEN: { color: "#64748b", label: "не начато" },
  SEEN: { color: "#fbbf24", label: "пробел" },
  PRACTICED: { color: "#38bdf8", label: "частично" },
  MASTERED: { color: "#34d399", label: "освоено" },
};

const MASTERY_RANK: Record<MasteryLevel, number> = { SEEN: 0, PRACTICED: 1, MASTERED: 2, UNSEEN: 3 };

type Phase = "loading" | "empty" | "intro" | "asking" | "submitting" | "results";

// ── One question step (own local answer state) ──────────────────────────────
function QuestionStep({
  q,
  index,
  total,
  onAnswer,
}: {
  q: DiagnosticQuestion;
  index: number;
  total: number;
  onAnswer: (answer: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [text, setText] = useState("");
  const answer = q.type === "MULTIPLE_CHOICE" ? selected ?? "" : text.trim();

  return (
    <motion.div
      key={q.id}
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
        Вопрос {index + 1} из {total}
      </div>
      <p className="text-sm font-medium mb-4" style={{ color: "var(--text-primary)" }}>
        {q.question}
      </p>

      {q.type === "MULTIPLE_CHOICE" ? (
        <div className="flex flex-col gap-2 mb-5">
          {q.options.map((opt, i) => {
            const on = selected === opt;
            return (
              <button
                key={i}
                onClick={() => setSelected(opt)}
                className="text-left text-sm px-4 py-3 rounded-xl transition-all"
                style={{
                  background: on ? "var(--accent-subtle)" : "var(--bg-input)",
                  color: on ? "var(--accent)" : "var(--text-secondary)",
                  border: `1px solid ${on ? "var(--accent)" : "var(--border)"}`,
                }}
              >
                {opt}
              </button>
            );
          })}
        </div>
      ) : (
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && answer) onAnswer(answer); }}
          placeholder="Введите ответ…"
          className="input-field mb-5"
        />
      )}

      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => onAnswer("")}
          className="text-xs font-medium transition-colors hover:text-[var(--text-secondary)]"
          style={{ color: "var(--text-muted)" }}
        >
          Не знаю
        </button>
        <button
          onClick={() => onAnswer(answer)}
          disabled={!answer}
          className="btn-primary text-sm disabled:opacity-40"
        >
          {index + 1 === total ? "Завершить" : "Далее"}
        </button>
      </div>
    </motion.div>
  );
}

// ── Modal ───────────────────────────────────────────────────────────────────
export function DiagnosticModal({
  topicId,
  topicTitle,
  nodeTitleById,
  onClose,
  onComplete,
}: {
  topicId: string;
  topicTitle: string;
  nodeTitleById: Map<string, string>;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [questions, setQuestions] = useState<DiagnosticQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<{ questionId: string; answer: string }[]>([]);
  const [result, setResult] = useState<DiagnosticResult | null>(null);

  useEffect(() => {
    let active = true;
    fetchDiagnostic(topicId, 10)
      .then((qs) => {
        if (!active) return;
        setQuestions(qs);
        setPhase(qs.length === 0 ? "empty" : "intro");
      })
      .catch(() => active && setPhase("empty"));
    return () => { active = false; };
  }, [topicId]);

  const handleAnswer = async (answer: string) => {
    const q = questions[index];
    const next = [...answers, { questionId: q.id, answer }];
    setAnswers(next);
    if (index + 1 < questions.length) {
      setIndex(index + 1);
      return;
    }
    setPhase("submitting");
    try {
      const res = await submitDiagnostic(next);
      setResult(res);
      setPhase("results");
    } catch {
      setPhase("results");
      setResult({ results: [], byNode: [], score: { correct: 0, total: next.length } });
    }
  };

  const sortedNodes = useMemo(() => {
    if (!result) return [];
    return [...result.byNode].sort((a, b) => MASTERY_RANK[a.mastery] - MASTERY_RANK[b.mastery]);
  }, [result]);

  const gapCount = sortedNodes.filter((n) => n.mastery === "SEEN").length;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0"
        style={{ background: "rgba(3,7,15,0.6)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        className="relative w-full max-w-lg rounded-2xl overflow-hidden"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", boxShadow: "0 30px 80px -20px rgba(0,0,0,0.6)" }}
      >
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center gap-2">
            <span style={{ color: "var(--accent)", fontSize: 16 }}>◍</span>
            <div>
              <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Диагностика</div>
              <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>{topicTitle}</div>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost !p-1.5 text-base" style={{ color: "var(--text-muted)" }}>✕</button>
        </div>

        {/* Progress bar */}
        {phase === "asking" && (
          <div className="h-1 w-full" style={{ background: "var(--bg-input)" }}>
            <div className="h-full transition-all duration-300" style={{ width: `${(index / questions.length) * 100}%`, background: "var(--accent)" }} />
          </div>
        )}

        <div className="p-6">
          {phase === "loading" && (
            <div className="py-12 flex flex-col items-center gap-3">
              <div className="w-9 h-9 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>Собираю вопросы…</p>
            </div>
          )}

          {phase === "empty" && (
            <div className="py-10 text-center">
              <div className="text-3xl mb-3">◎</div>
              <p className="text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Пока нет вопросов для диагностики</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Добавьте квизы к узлам темы в редакторе.</p>
            </div>
          )}

          {phase === "intro" && (
            <div className="text-center py-4">
              <div className="text-4xl mb-4">◍</div>
              <h3 className="font-display text-xl mb-2" style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                Проверим твой уровень
              </h3>
              <p className="text-sm mb-6 max-w-sm mx-auto" style={{ color: "var(--text-secondary)" }}>
                {questions.length} {questions.length < 5 ? "коротких вопроса" : "коротких вопросов"} по теме.
                По итогам подсветим, что уже освоено, а где пробелы.
              </p>
              <button onClick={() => setPhase("asking")} className="btn-cta">Начать диагностику →</button>
            </div>
          )}

          {phase === "asking" && questions[index] && (
            <AnimatePresence mode="wait">
              <QuestionStep
                key={questions[index].id}
                q={questions[index]}
                index={index}
                total={questions.length}
                onAnswer={handleAnswer}
              />
            </AnimatePresence>
          )}

          {phase === "submitting" && (
            <div className="py-12 flex flex-col items-center gap-3">
              <div className="w-9 h-9 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>Считаю результат…</p>
            </div>
          )}

          {phase === "results" && result && (
            <div>
              <div className="text-center mb-5">
                <div className="font-display text-4xl" style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                  {result.score.correct}<span style={{ color: "var(--text-muted)" }}> / {result.score.total}</span>
                </div>
                <div className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>верных ответов</div>
                {gapCount > 0 && (
                  <div className="text-xs mt-2" style={{ color: "var(--danger)" }}>
                    Нашли {gapCount} {gapCount === 1 ? "пробел" : "пробела(ов)"} — закроем их на маршруте
                  </div>
                )}
              </div>

              <div className="space-y-1.5 max-h-56 overflow-y-auto mb-5">
                {sortedNodes.map((n) => {
                  const meta = MASTERY[n.mastery];
                  return (
                    <div
                      key={n.nodeId}
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg"
                      style={{ background: "var(--bg-input)", border: "1px solid var(--border-subtle)" }}
                    >
                      <span className="text-sm truncate" style={{ color: "var(--text-primary)" }}>
                        {nodeTitleById.get(n.nodeId) ?? n.nodeId}
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{n.correct}/{n.total}</span>
                        <span className="badge text-[10px]" style={{ background: `${meta.color}22`, color: meta.color }}>
                          {meta.label}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-end gap-2">
                <button onClick={onClose} className="btn-ghost text-sm">Закрыть</button>
                <button onClick={() => { onComplete(); onClose(); }} className="btn-primary text-sm">
                  Показать на карте →
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
