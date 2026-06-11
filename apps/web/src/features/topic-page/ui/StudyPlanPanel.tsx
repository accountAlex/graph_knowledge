"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { StudyPlanItem } from "@mathgraph/shared";

export function StudyPlanPanel({ goalTopicId }: { goalTopicId: string }) {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;
  const [plan, setPlan] = useState<StudyPlanItem[]>([]);
  const [loading, setLoading] = useState<boolean>(!!baseUrl);
  const [error, setError] = useState<string | null>(baseUrl ? null : "NEXT_PUBLIC_API_URL is not set");

  useEffect(() => {
    if (!baseUrl) return;

    const ac = new AbortController();
    fetch(`${baseUrl}/study-plan?goalTopicId=${goalTopicId}&maxDepth=5`, { signal: ac.signal })
      .then((res) => res.json())
      .then(setPlan)
      .catch((e) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        if (e?.message?.includes("aborted")) return;
        setError("Не удалось загрузить план");
      })
      .finally(() => setLoading(false));

    return () => ac.abort();
  }, [goalTopicId, baseUrl]);

  return (
    <div className="glass-card p-4 !transform-none">
      <div
        className="text-xs font-semibold uppercase tracking-widest mb-3"
        style={{ color: "var(--text-muted)" }}
      >
        План изучения
      </div>

      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-10 w-full" />
          ))}
        </div>
      )}

      {error && (
        <div style={{ color: "var(--danger)" }} className="text-sm">
          {error}
        </div>
      )}

      {!loading && plan.length > 0 && (
        <div className="flex flex-col gap-1">
          {plan.map((item, idx) => (
            <Link
              key={item.id}
              href={`/topic/${item.id}`}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 hover:bg-[var(--accent-subtle)] group animate-fade-in delay-${Math.min(idx + 1, 6)}`}
              style={{ color: "var(--text-primary)" }}
            >
              <span
                className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 transition-all duration-200 group-hover:scale-110"
                style={{
                  background: "var(--accent-subtle)",
                  color: "var(--accent)",
                }}
              >
                {idx + 1}
              </span>
              <span className="font-medium">{item.title}</span>
            </Link>
          ))}
        </div>
      )}

      {!loading && plan.length === 0 && !error && (
        <div style={{ color: "var(--text-muted)" }} className="text-sm text-center py-3">
          Пререквизитов нет
        </div>
      )}
    </div>
  );
}
