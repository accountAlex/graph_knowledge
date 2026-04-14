"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { buildRoute, type LearningRoute, type RouteStep } from "@/lib/routeApi";

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
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
          style={{
            background: isLast
              ? "linear-gradient(135deg, var(--accent), var(--accent-hover))"
              : "var(--bg-card)",
            color: isLast ? "#fff" : "var(--accent)",
            border: isLast ? "none" : "2px solid var(--accent)",
          }}
        >
          {step.order}
        </div>
        {!isLast && (
          <div
            className="w-0.5 flex-1 my-1 min-h-[24px]"
            style={{ background: "var(--border)" }}
          />
        )}
      </div>

      {/* Card */}
      <div
        className="flex-1 rounded-xl p-4 mb-4"
        style={{
          background: isLast ? "var(--accent-subtle)" : "var(--bg-card)",
          border: `1px solid ${isLast ? "var(--accent)" : "var(--border)"}`,
        }}
      >
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3
            className="text-sm font-semibold"
            style={{ color: isLast ? "var(--accent)" : "var(--text-primary)" }}
          >
            {step.title}
            {isLast && <span className="ml-2 text-[11px] font-normal">← цель</span>}
          </h3>
          <Link
            href={`/topic/${step.topicId}?track=school&depth=1`}
            className="shrink-0 text-[11px] px-2.5 py-1 rounded-lg transition-colors hover:bg-[var(--accent)]"
            style={{
              background: "var(--bg-input)",
              color: "var(--text-muted)",
              border: "1px solid var(--border)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = "#fff";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
            }}
          >
            Открыть →
          </Link>
        </div>

        {step.description && (
          <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
            {step.description}
          </p>
        )}

        {step.why && (
          <p
            className="text-xs italic"
            style={{ color: "var(--text-secondary)", borderLeft: "2px solid var(--border)", paddingLeft: 8 }}
          >
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
      const result = await buildRoute(trimmed);
      setRoute(result);
    } catch {
      setError("Не удалось построить маршрут. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Header */}
        <Link
          href="/"
          className="text-xs mb-6 inline-flex items-center gap-1 transition-colors hover:text-[var(--accent)]"
          style={{ color: "var(--text-muted)" }}
        >
          ← На главную
        </Link>

        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
            AI-маршрут обучения
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Напиши цель — получи персональный план с нужными темами в правильном порядке
          </p>
        </div>

        {/* Input */}
        <div className="glass-card p-5 mb-6 !transform-none">
          <label className="text-[10px] font-semibold uppercase tracking-wider mb-2 block" style={{ color: "var(--text-muted)" }}>
            Твоя цель
          </label>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleBuild(); }}
              placeholder="Хочу разобраться с логарифмами..."
              className="input-field text-sm flex-1"
              disabled={loading}
            />
            <button
              onClick={() => handleBuild()}
              disabled={!goal.trim() || loading}
              className="btn-primary px-5 text-sm disabled:opacity-40 shrink-0"
            >
              {loading ? "..." : "Построить"}
            </button>
          </div>

          {/* Example prompts */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => { setGoal(ex); handleBuild(ex); }}
                disabled={loading}
                className="text-[11px] px-2.5 py-1 rounded-lg transition-colors disabled:opacity-40"
                style={{
                  background: "var(--bg-input)",
                  color: "var(--text-muted)",
                  border: "1px solid var(--border)",
                }}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="glass-card p-8 !transform-none flex flex-col items-center gap-3 animate-fade-in">
            <div
              className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
            />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Анализирую граф знаний и строю маршрут...
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            className="rounded-xl p-4 text-sm animate-fade-in"
            style={{ background: "rgba(248,113,133,0.1)", color: "var(--danger)", border: "1px solid rgba(248,113,133,0.3)" }}
          >
            {error}
          </div>
        )}

        {/* Result */}
        {route && !loading && (
          <div className="animate-fade-in">
            {/* Matched topic + summary */}
            <div className="glass-card p-5 mb-6 !transform-none">
              {route.matchedTopicId ? (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Цель найдена:</span>
                    <span
                      className="text-xs font-bold px-2.5 py-1 rounded-lg"
                      style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}
                    >
                      {route.matchedTitle}
                    </span>
                  </div>
                  {route.summary && (
                    <p className="text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
                      {route.summary}
                    </p>
                  )}
                  <div className="mt-3 flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                    <span>{route.steps.length} {route.steps.length === 1 ? "тема" : route.steps.length < 5 ? "темы" : "тем"} в маршруте</span>
                  </div>
                </>
              ) : (
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  {route.summary}
                </p>
              )}
            </div>

            {/* Steps */}
            {route.steps.length > 0 && (
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--text-muted)" }}>
                  Маршрут — от основ к цели
                </div>
                {route.steps.map((step, i) => (
                  <StepCard
                    key={step.topicId}
                    step={step}
                    isLast={i === route.steps.length - 1}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
