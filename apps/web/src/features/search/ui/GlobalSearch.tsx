"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { searchNodes, type SearchResult } from "@/lib/searchApi";

const ROLE_META: Record<string, { label: string; color: string }> = {
  TOPIC:   { label: "Тема",    color: "var(--role-topic)"   },
  CONCEPT: { label: "Понятие", color: "var(--role-concept)" },
  METHOD:  { label: "Метод",   color: "var(--role-method)"  },
  SKILL:   { label: "Навык",   color: "var(--role-skill)"   },
  TASK:    { label: "Задача",  color: "var(--role-task)"    },
};

type Props = {
  /** Called when query changes — lets parent filter its own list */
  onQueryChange?: (q: string) => void;
  placeholder?: string;
  className?: string;
};

export function GlobalSearch({ onQueryChange, placeholder = "Поиск по графу знаний...", className }: Props) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search
  useEffect(() => {
    onQueryChange?.(q);

    if (timerRef.current) clearTimeout(timerRef.current);

    if (q.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchNodes(q, 10);
        setResults(res);
        setOpen(true);
        setActiveIdx(-1);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 280);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [q]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const navigate = (result: SearchResult) => {
    setOpen(false);
    setQ("");
    router.push(`/topic/${encodeURIComponent(result.id)}?track=school&depth=0`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      navigate(results[activeIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      {/* Input */}
      <div className="relative">
        <svg
          className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
          style={{ color: loading ? "var(--accent)" : "var(--text-muted)" }}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          {loading ? (
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              style={{ animation: "spin-slow 1s linear infinite" }}
            />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          )}
        </svg>
        <input
          className="input-field !pl-11 w-full"
          placeholder={placeholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={handleKeyDown}
          aria-autocomplete="list"
          aria-expanded={open}
        />
        {q && (
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-xs transition-colors hover:bg-[var(--bg-input)]"
            style={{ color: "var(--text-muted)" }}
            onClick={() => { setQ(""); setResults([]); setOpen(false); }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div
          className="absolute top-full left-0 right-0 mt-1.5 z-50 rounded-2xl overflow-hidden shadow-2xl"
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            boxShadow: "0 20px 60px var(--shadow-color)",
          }}
        >
          {results.map((r, i) => {
            const meta = ROLE_META[r.role] ?? { label: r.role, color: "var(--text-muted)" };
            const isActive = i === activeIdx;
            return (
              <button
                key={r.id}
                className="w-full text-left px-4 py-3 flex items-start gap-3 transition-colors"
                style={{
                  background: isActive ? "var(--bg-card)" : "transparent",
                  borderTop: i > 0 ? "1px solid var(--border-subtle)" : undefined,
                }}
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => navigate(r)}
              >
                {/* Role dot */}
                <div
                  className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                  style={{ background: meta.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium truncate">{r.title}</span>
                    <span
                      className="badge shrink-0 text-[10px]"
                      style={{ background: `${meta.color}20`, color: meta.color }}
                    >
                      {meta.label}
                    </span>
                    {r.fipiCode && (
                      <span className="text-[10px] shrink-0" style={{ color: "var(--text-muted)" }}>
                        {r.fipiCode}
                      </span>
                    )}
                  </div>
                  {r.description && (
                    <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
                      {r.description}
                    </p>
                  )}
                </div>
              </button>
            );
          })}

          <div
            className="px-4 py-2 text-[10px] text-right"
            style={{ color: "var(--text-muted)", borderTop: "1px solid var(--border)" }}
          >
            ↑↓ навигация · Enter для выбора · Esc закрыть
          </div>
        </div>
      )}

      {open && q.trim().length >= 2 && !loading && results.length === 0 && (
        <div
          className="absolute top-full left-0 right-0 mt-1.5 z-50 rounded-2xl px-4 py-5 text-center text-xs"
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            color: "var(--text-muted)",
          }}
        >
          Ничего не найдено по запросу «{q}»
        </div>
      )}
    </div>
  );
}
