"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchQuestions,
  fetchQuizStats,
  submitAnswer,
  type AnswerResult,
  type NodeQuizStats,
  type QuizQuestion,
} from "@/lib/quizApi";

type AttemptState = {
  questionId: string;
  result: AnswerResult;
  userAnswer: string;
};

// ── Single question card ──────────────────────────────────────────────────────
function QuestionCard({
  q,
  attempt,
  isAuth,
  onSubmit,
}: {
  q: QuizQuestion;
  attempt: AttemptState | null;
  isAuth: boolean;
  onSubmit: (questionId: string, answer: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const done = !!attempt;
  const correct = attempt?.result.correct;

  const handleSubmit = () => {
    const answer = q.type === "MULTIPLE_CHOICE" ? (selected ?? "") : text.trim();
    if (!answer) return;
    onSubmit(q.id, answer);
  };

  return (
    <div
      className="rounded-xl p-4 mb-3"
      style={{
        background: done
          ? correct
            ? "rgba(16,185,129,0.06)"
            : "rgba(239,68,68,0.06)"
          : "var(--bg-input)",
        border: `1px solid ${
          done ? (correct ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)") : "var(--border)"
        }`,
      }}
    >
      {/* Question text */}
      <p className="text-xs font-medium mb-3" style={{ color: "var(--text-primary)" }}>
        {q.question}
      </p>

      {/* Multiple choice options */}
      {q.type === "MULTIPLE_CHOICE" && (
        <div className="flex flex-col gap-1.5 mb-3">
          {q.options.map((opt, i) => {
            const isSelected = selected === opt;
            const isCorrect = done && opt === attempt?.result.correctAnswer;
            const isWrong = done && opt === attempt?.userAnswer && !correct;
            return (
              <button
                key={i}
                disabled={done || !isAuth}
                onClick={() => setSelected(opt)}
                className="text-left text-xs px-3 py-2 rounded-lg transition-all duration-200"
                style={{
                  background: isCorrect
                    ? "rgba(16,185,129,0.15)"
                    : isWrong
                    ? "rgba(239,68,68,0.15)"
                    : isSelected
                    ? "var(--accent-subtle)"
                    : "var(--bg-card)",
                  color: isCorrect
                    ? "#10b981"
                    : isWrong
                    ? "#ef4444"
                    : isSelected
                    ? "var(--accent)"
                    : "var(--text-secondary)",
                  border: `1px solid ${
                    isCorrect
                      ? "rgba(16,185,129,0.4)"
                      : isWrong
                      ? "rgba(239,68,68,0.4)"
                      : isSelected
                      ? "var(--accent)"
                      : "var(--border)"
                  }`,
                }}
              >
                {isCorrect ? "✓ " : isWrong ? "✕ " : ""}
                {opt}
              </button>
            );
          })}
        </div>
      )}

      {/* Text input */}
      {q.type === "TEXT_INPUT" && (
        <div className="mb-3">
          <input
            ref={inputRef}
            disabled={done || !isAuth}
            value={done ? attempt!.userAnswer : text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
            placeholder={isAuth ? "Введите ответ..." : "Войдите чтобы ответить"}
            className="w-full text-xs px-3 py-2 rounded-lg outline-none transition-all"
            style={{
              background: "var(--bg-card)",
              border: `1px solid ${done ? (correct ? "rgba(16,185,129,0.4)" : "rgba(239,68,68,0.4)") : "var(--border)"}`,
              color: "var(--text-primary)",
            }}
          />
        </div>
      )}

      {/* Result */}
      {done && (
        <div
          className="text-[11px] rounded-lg px-3 py-2 mb-2"
          style={{
            background: correct ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
            color: correct ? "#10b981" : "#ef4444",
          }}
        >
          {correct ? "Верно!" : `Правильный ответ: ${attempt!.result.correctAnswer}`}
          {attempt!.result.explanation && (
            <p className="mt-1 text-[10px]" style={{ color: "var(--text-secondary)" }}>
              {attempt!.result.explanation}
            </p>
          )}
        </div>
      )}

      {/* Submit button */}
      {!done && isAuth && (
        <button
          onClick={handleSubmit}
          disabled={q.type === "MULTIPLE_CHOICE" ? !selected : !text.trim()}
          className="text-[11px] font-medium px-3 py-1.5 rounded-lg transition-all disabled:opacity-40"
          style={{
            background: "var(--accent)",
            color: "#fff",
          }}
        >
          Ответить
        </button>
      )}

      {!isAuth && (
        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
          Войдите чтобы проверить ответ
        </p>
      )}
    </div>
  );
}

// ── Stats badge ───────────────────────────────────────────────────────────────
function StatsBadge({ stats }: { stats: NodeQuizStats }) {
  if (stats.total === 0) return null;
  const pct = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
  const color = pct >= 80 ? "#10b981" : pct >= 50 ? "#f59e0b" : "var(--accent)";
  return (
    <div className="flex items-center gap-2 text-[10px]" style={{ color: "var(--text-muted)" }}>
      <span>{stats.attempted}/{stats.total} попыток</span>
      {stats.attempted > 0 && (
        <span className="font-bold" style={{ color }}>
          {pct}% верно
        </span>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
type Props = { nodeId: string; isAuth: boolean };

export function NodeQuizPanel({ nodeId, isAuth }: Props) {
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [stats, setStats] = useState<NodeQuizStats | null>(null);
  const [attempts, setAttempts] = useState<Map<string, AttemptState>>(new Map());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setAttempts(new Map());
    try {
      const qs = await fetchQuestions(nodeId);
      setQuestions(qs);
      if (isAuth && qs.length > 0) {
        const s = await fetchQuizStats(nodeId);
        setStats(s);
      }
    } catch {
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }, [nodeId, isAuth]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = useCallback(
    async (questionId: string, answer: string) => {
      if (!isAuth) return;
      try {
        const result = await submitAnswer(questionId, answer);
        setAttempts((prev) => {
          const next = new Map(prev);
          next.set(questionId, { questionId, result, userAnswer: answer });
          return next;
        });
        // Refresh stats after answer
        const s = await fetchQuizStats(nodeId);
        setStats(s);
      } catch { /* ignore */ }
    },
    [isAuth, nodeId],
  );

  if (loading) {
    return (
      <div className="text-xs text-center py-4" style={{ color: "var(--text-muted)" }}>
        Загрузка...
      </div>
    );
  }

  if (!questions || questions.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-muted)" }}
        >
          Квиз
        </span>
        {stats && <StatsBadge stats={stats} />}
      </div>

      {questions.map((q) => (
        <QuestionCard
          key={q.id}
          q={q}
          attempt={attempts.get(q.id) ?? null}
          isAuth={isAuth}
          onSubmit={handleSubmit}
        />
      ))}
    </div>
  );
}
