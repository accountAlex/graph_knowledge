"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { buildRoute, type LearningRoute, type RouteStep } from "@/lib/routeApi";
import { PageHeader } from "@/components/PageHeader";

const EXAMPLES = [
  "хочу понять интегралы",
  "готовлюсь к ЕГЭ по тригонометрии",
  "не понимаю логарифмы",
  "хочу разобраться с производной",
  "готовлюсь решать задачи на вероятность",
];

function StepCard({ step, isLast }: { step: RouteStep; isLast: boolean }) {
  return (
    <div className="flex gap-4">
      {/* Timeline */}
      <div className="flex flex-col items-center shrink-0">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-display"
          style={{
            background: isLast ? "var(--accent)" : "var(--bg-card)",
            color: isLast ? "#fff" : "var(--accent)",
            border: isLast ? "none" : "2px solid var(--border-glow)",
            fontWeight: 700,
            fontSize: 13,
            boxShadow: isLast ? "0 6px 18px -6px var(--accent-glow)" : "none",
          }}
        >
          {step.order}
        </div>
        {!isLast && <div className="w-px flex-1 my-1 min-h-[28px]" style={{ background: "var(--border)" }} />}
      </div>

      {/* Card */}
      <div
        className="flex-1 rounded-2xl p-4 mb-4 transition-colors"
        style={{
          background: isLast ? "var(--accent-subtle)" : "var(--bg-card)",
          border: `1px solid ${isLast ? "var(--border-glow)" : "var(--border)"}`,
        }}
      >
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="text-sm font-semibold" style={{ color: isLast ? "var(--accent)" : "var(--text-primary)" }}>
            {step.title}
            {isLast && <span className="ml-2 text-[11px] font-normal">← цель</span>}
          </h3>
          <Link
            href={`/topic/${step.topicId}?track=school&depth=1`}
            className="shrink-0 text-[11px] px-2.5 py-1 rounded-full transition-colors hover:bg-[var(--accent)] hover:text-white"
            style={{ background: "var(--bg-input)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
          >
            Открыть →
          </Link>
        </div>

        {step.description && <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>{step.description}</p>}
        {step.why && (
          <p className="text-xs italic" style={{ color: "var(--text-secondary)", borderLeft: "2px solid var(--border-glow)", paddingLeft: 8 }}>
            {step.why}
          </p>
        )}
      </div>
    </div>
  );
}

export default function RoutePage() {
  const [goal, setGoal] = useState("");
  const [loading, setLoading] = useState(false);
  const [route, setRoute] = useState<LearningRoute | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleBuild = async (g = goal) => {
    const trimmed = g.trim();
    if (!trimmed) return;
    setLoading(true);
    setError("");
    setRoute(null);
    try {
      setRoute(await buildRoute(trimmed));
    } catch {
      setError("Не удалось построить маршрут. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <PageHeader
        eyebrow="AI-репетитор"
        title={
          <>
            Маршрут обучения <span style={{ color: "var(--accent)" }}>за минуту</span>
          </>
        }
        subtitle="Напишите цель — получите персональный план: нужные темы в правильном порядке, от основ к результату."
      />

      <div className="mx-auto max-w-2xl px-5 sm:px-6 py-10">
        {/* Input */}
        <div className="rounded-2xl p-5 mb-6" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <label className="eyebrow mb-3">Твоя цель</label>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleBuild(); }}
              placeholder="Хочу разобраться с логарифмами…"
              className="input-field text-sm flex-1"
              disabled={loading}
            />
            <button onClick={() => handleBuild()} disabled={!goal.trim() || loading} className="btn-primary px-5 text-sm disabled:opacity-40 shrink-0">
              {loading ? "…" : "Построить"}
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 mt-3">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => { setGoal(ex); handleBuild(ex); }}
                disabled={loading}
                className="text-[11px] px-2.5 py-1 rounded-full transition-all hover:-translate-y-0.5 disabled:opacity-40"
                style={{ background: "var(--bg-input)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div className="rounded-2xl p-8 flex flex-col items-center gap-3 animate-fade-in" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Анализирую граф знаний и строю маршрут…</p>
          </div>
        )}

        {error && (
          <div className="rounded-2xl p-4 text-sm animate-fade-in" style={{ background: "rgba(255,107,107,0.1)", color: "var(--danger)", border: "1px solid rgba(255,107,107,0.3)" }}>
            {error}
          </div>
        )}

        {route && !loading && (
          <div className="animate-fade-in">
            <div className="rounded-2xl p-5 mb-6" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              {route.matchedTopicId ? (
                <>
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Цель найдена:</span>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}>
                      {route.matchedTitle}
                    </span>
                  </div>
                  {route.summary && <p className="text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>{route.summary}</p>}
                  <div className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
                    {route.steps.length} {route.steps.length === 1 ? "тема" : route.steps.length < 5 ? "темы" : "тем"} в маршруте
                  </div>
                </>
              ) : (
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>{route.summary}</p>
              )}
            </div>

            {route.steps.length > 0 && (
              <div>
                <div className="eyebrow mb-4">Маршрут — от основ к цели</div>
                {route.steps.map((step, i) => (
                  <StepCard key={step.topicId} step={step} isLast={i === route.steps.length - 1} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
