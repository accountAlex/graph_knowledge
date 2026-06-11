"use client";

import { useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  fetchSuggestions,
  approveSuggestion,
  rejectSuggestion,
  type LinkSuggestion,
} from "@/lib/autoLinkApi";

const ROLE_COLOR: Record<string, string> = {
  TOPIC:   "var(--role-topic)",
  CONCEPT: "var(--role-concept)",
  METHOD:  "var(--role-method)",
  SKILL:   "var(--role-skill)",
  TASK:    "var(--role-task)",
};

const ROLE_LABELS: Record<string, string> = {
  TOPIC: "Тема", CONCEPT: "Понятие", METHOD: "Метод", SKILL: "Навык", TASK: "Задача",
};

function RoleBadge({ role }: { role: string }) {
  return (
    <span
      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
      style={{
        background: `${ROLE_COLOR[role] ?? "var(--accent)"}22`,
        color: ROLE_COLOR[role] ?? "var(--accent)",
      }}
    >
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

function SimilarityBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = value >= 0.92 ? "#4ade80" : value >= 0.87 ? "#facc15" : "#fb923c";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full" style={{ background: "var(--border)" }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-[11px] font-mono font-semibold" style={{ color }}>
        {pct}%
      </span>
    </div>
  );
}

type CardState = "pending" | "approved" | "rejected";

export default function AutoLinkPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [suggestions, setSuggestions] = useState<LinkSuggestion[]>([]);
  const [states, setStates] = useState<Record<string, CardState>>({});
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // key of card being processed

  useEffect(() => {
    if (!loading && user && user.role !== "ADMIN" && user.role !== "COMPOSER") {
      router.replace("/");
    }
  }, [user, loading, router]);

  if (loading || !user) return null;
  if (user.role !== "ADMIN" && user.role !== "COMPOSER") return null;

  function cardKey(s: LinkSuggestion) {
    return `${s.fromId}→${s.toId}`;
  }

  async function load() {
    setFetching(true);
    setError(null);
    setStates({});
    try {
      const data = await fetchSuggestions();
      setSuggestions(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setFetching(false);
    }
  }

  async function approve(s: LinkSuggestion) {
    const key = cardKey(s);
    setBusy(key);
    try {
      await approveSuggestion(s.fromId, s.toId);
      setStates((prev) => ({ ...prev, [key]: "approved" }));
    } catch {
      setError("Не удалось одобрить");
    } finally {
      setBusy(null);
    }
  }

  async function reject(s: LinkSuggestion) {
    const key = cardKey(s);
    setBusy(key);
    await rejectSuggestion(s.fromId, s.toId);
    setStates((prev) => ({ ...prev, [key]: "rejected" }));
    setBusy(null);
  }

  const pending = suggestions.filter((s) => states[cardKey(s)] === undefined);
  const done    = suggestions.filter((s) => states[cardKey(s)] !== undefined);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-page)" }}>
      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
            ✦ AI-автосвязи
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Mistral embeddings находят узлы с похожим содержанием и предлагают добавить
            связь PREREQ_REQUIRED. Вы одобряете или отклоняете каждую пару.
          </p>
        </div>

        {/* Action */}
        {suggestions.length === 0 && !fetching && (
          <div
            className="rounded-2xl p-8 text-center mb-8"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            <div className="text-4xl mb-3">◯</div>
            <p className="text-sm mb-5" style={{ color: "var(--text-muted)" }}>
              Нажми кнопку — система проанализирует все опубликованные узлы и найдёт похожие.
              <br />Это займёт ~10–20 секунд.
            </p>
            <button
              onClick={load}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              Найти предложения
            </button>
          </div>
        )}

        {fetching && (
          <div className="flex flex-col items-center gap-4 py-16" style={{ color: "var(--text-muted)" }}>
            <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
            <span className="text-sm">Эмбеддинг узлов через Mistral…</span>
          </div>
        )}

        {error && (
          <div className="rounded-xl px-4 py-3 mb-6 text-sm" style={{ background: "#ef444422", color: "#f87171", border: "1px solid #ef444444" }}>
            {error}
          </div>
        )}

        {/* Stats bar */}
        {suggestions.length > 0 && !fetching && (
          <div className="flex items-center justify-between mb-5">
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>
              {pending.length} ожидают · {done.filter((s) => states[cardKey(s)] === "approved").length} одобрено · {done.filter((s) => states[cardKey(s)] === "rejected").length} отклонено
            </span>
            <button
              onClick={load}
              className="text-xs px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
              style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}
            >
              ↺ Обновить
            </button>
          </div>
        )}

        {/* Cards */}
        <div className="flex flex-col gap-3">
          {suggestions.map((s) => {
            const key = cardKey(s);
            const state = states[key];
            const isBusy = busy === key;

            return (
              <div
                key={key}
                className="rounded-2xl p-4 transition-all duration-300"
                style={{
                  background:
                    state === "approved" ? "rgba(74,222,128,0.06)" :
                    state === "rejected" ? "rgba(0,0,0,0.0)" :
                    "var(--bg-card)",
                  border: `1px solid ${
                    state === "approved" ? "rgba(74,222,128,0.3)" :
                    state === "rejected" ? "var(--border-subtle)" :
                    "var(--border)"
                  }`,
                  opacity: state === "rejected" ? 0.4 : 1,
                }}
              >
                {/* Node pair */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <RoleBadge role={s.fromRole} />
                      <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                        {s.fromTitle}
                      </span>
                    </div>
                  </div>

                  <div className="flex-shrink-0 text-lg" style={{ color: "var(--text-muted)" }}>
                    →
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <RoleBadge role={s.toRole} />
                      <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                        {s.toTitle}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Similarity bar */}
                <SimilarityBar value={s.similarity} />

                {/* Actions */}
                {!state && (
                  <div className="flex gap-2 mt-3">
                    <button
                      disabled={isBusy}
                      onClick={() => approve(s)}
                      className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90 disabled:opacity-50"
                      style={{ background: "rgba(74,222,128,0.15)", color: "#4ade80" }}
                    >
                      {isBusy ? "…" : "✓ Одобрить"}
                    </button>
                    <button
                      disabled={isBusy}
                      onClick={() => reject(s)}
                      className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90 disabled:opacity-50"
                      style={{ background: "var(--bg-card)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
                    >
                      {isBusy ? "…" : "✕ Отклонить"}
                    </button>
                  </div>
                )}

                {state === "approved" && (
                  <p className="text-xs mt-2 font-medium" style={{ color: "#4ade80" }}>
                    ✓ Связь добавлена в граф
                  </p>
                )}
                {state === "rejected" && (
                  <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
                    Отклонено
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {suggestions.length > 0 && pending.length === 0 && !fetching && (
          <div className="text-center py-10 text-sm" style={{ color: "var(--text-muted)" }}>
            Все предложения обработаны.
          </div>
        )}
      </div>
    </div>
  );
}
