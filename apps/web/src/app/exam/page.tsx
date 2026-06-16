"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/providers/AuthProvider";
import { PageHeader } from "@/components/PageHeader";
import { MathInput } from "@/components/MathInput";
import {
  fetchExam,
  submitDiagnostic,
  type DiagnosticQuestion,
  type DiagnosticResult,
} from "@/lib/quizApi";

type Phase = "loading" | "empty" | "running" | "submitting" | "results";

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function ExamPage() {
  const { user, loading: authLoading } = useAuth();
  const [phase, setPhase] = useState<Phase>("loading");
  const [questions, setQuestions] = useState<DiagnosticQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [mathMode, setMathMode] = useState<Record<string, boolean>>({});
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<DiagnosticResult | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    let active = true;
    fetchExam(15)
      .then((qs) => { if (active) { setQuestions(qs); setPhase(qs.length ? "running" : "empty"); } })
      .catch(() => active && setPhase("empty"));
    return () => { active = false; };
  }, [user, authLoading]);

  useEffect(() => {
    if (phase !== "running") return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  const answered = Object.values(answers).filter((a) => a.trim()).length;
  const showLogin = !authLoading && !user;

  const finish = async () => {
    setPhase("submitting");
    const payload = questions.map((q) => ({ questionId: q.id, answer: answers[q.id] ?? "" }));
    try {
      setResult(await submitDiagnostic(payload));
    } catch {
      setResult({ results: [], byNode: [], score: { correct: 0, total: payload.length } });
    }
    setPhase("results");
  };

  const mastered = result?.byNode.filter((n) => n.mastery === "MASTERED").length ?? 0;
  const partial = result?.byNode.filter((n) => n.mastery === "PRACTICED").length ?? 0;
  const gaps = result?.byNode.filter((n) => n.mastery === "SEEN").length ?? 0;

  return (
    <main className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <PageHeader
        eyebrow="Пробный экзамен"
        title={<>Вариант <span style={{ color: "var(--accent)" }}>на проверку</span></>}
        subtitle="Реши задачи как на настоящем экзамене. По итогам обновим карту прогресса и подсветим пробелы."
        back="/roadmap"
        backLabel="К графу"
      />

      <div className="mx-auto max-w-2xl px-5 sm:px-6 py-10">
        {phase === "loading" && !showLogin && (
          <div className="py-16 flex justify-center">
            <div className="w-9 h-9 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
          </div>
        )}

        {(phase === "empty" || showLogin) && (
          <div className="text-center py-16">
            <div className="text-4xl mb-4">{user ? "◎" : "◉"}</div>
            <h2 className="font-display text-xl mb-2" style={{ fontWeight: 700, color: "var(--text-primary)" }}>
              {user ? "Пока нет вопросов для варианта" : "Войдите, чтобы сдать вариант"}
            </h2>
            <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
              {user ? "Добавьте квизы к задачам в редакторе — и вариант соберётся автоматически." : "Результат варианта привязывается к аккаунту."}
            </p>
            <Link href={user ? "/roadmap" : "/auth"} className="btn-primary">{user ? "К графу знаний" : "Войти"}</Link>
          </div>
        )}

        {phase === "running" && (
          <div>
            {/* Sticky bar */}
            <div className="sticky top-16 z-10 -mx-5 sm:-mx-6 px-5 sm:px-6 py-3 mb-5 flex items-center justify-between"
              style={{ background: "var(--bg-glass)", backdropFilter: "blur(12px)", borderBottom: "1px solid var(--border-subtle)" }}>
              <div className="flex items-center gap-4 text-sm">
                <span className="font-display" style={{ fontWeight: 700, color: "var(--text-primary)" }}>{fmt(elapsed)}</span>
                <span style={{ color: "var(--text-muted)" }}>{answered}/{questions.length} отвечено</span>
              </div>
              <button onClick={finish} className="btn-primary text-sm">Завершить</button>
            </div>

            <div className="space-y-4">
              {questions.map((q, i) => (
                <div key={q.id} className="rounded-2xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                  <div className="flex items-start gap-2 mb-3">
                    <span className="font-display text-sm shrink-0" style={{ fontWeight: 700, color: "var(--accent)" }}>{i + 1}.</span>
                    <p className="text-sm" style={{ color: "var(--text-primary)" }}>{q.question}</p>
                  </div>

                  {q.type === "MULTIPLE_CHOICE" ? (
                    <div className="flex flex-col gap-2">
                      {q.options.map((opt, k) => {
                        const on = answers[q.id] === opt;
                        return (
                          <button
                            key={k}
                            onClick={() => setAnswers((p) => ({ ...p, [q.id]: opt }))}
                            className="text-left text-sm px-3.5 py-2.5 rounded-xl transition-all"
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
                    <div>
                      {mathMode[q.id] ? (
                        <MathInput value={answers[q.id] ?? ""} onChange={(v) => setAnswers((p) => ({ ...p, [q.id]: v }))} />
                      ) : (
                        <input
                          value={answers[q.id] ?? ""}
                          onChange={(e) => setAnswers((p) => ({ ...p, [q.id]: e.target.value }))}
                          placeholder="Ваш ответ…"
                          className="input-field"
                        />
                      )}
                      <button
                        onClick={() => setMathMode((p) => ({ ...p, [q.id]: !p[q.id] }))}
                        className="mt-2 text-[11px] font-medium transition-colors hover:text-[var(--accent)]"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {mathMode[q.id] ? "✏ обычный ввод" : "∑ формула"}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6 text-center">
              <button onClick={finish} className="btn-cta">Завершить вариант</button>
            </div>
          </div>
        )}

        {phase === "submitting" && (
          <div className="py-16 flex flex-col items-center gap-3">
            <div className="w-9 h-9 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Проверяю работу…</p>
          </div>
        )}

        {phase === "results" && result && (
          <div className="text-center">
            <div className="font-display text-5xl mb-1" style={{ fontWeight: 700, color: "var(--text-primary)" }}>
              {result.score.correct}<span style={{ color: "var(--text-muted)" }}> / {result.score.total}</span>
            </div>
            <div className="text-sm" style={{ color: "var(--text-secondary)" }}>верных ответов · время {fmt(elapsed)}</div>

            <div className="flex items-center justify-center gap-5 mt-6 mb-7 text-sm">
              <span style={{ color: "#34d399" }}>освоено {mastered}</span>
              <span style={{ color: "#38bdf8" }}>частично {partial}</span>
              <span style={{ color: "var(--danger)" }}>пробелы {gaps}</span>
            </div>

            <div className="flex items-center justify-center gap-3">
              <Link href="/roadmap" className="btn-primary">Посмотреть на карте</Link>
              <Link href="/review" className="btn-ghost">К повторению</Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
