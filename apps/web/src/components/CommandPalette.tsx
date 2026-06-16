"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/providers/AuthProvider";
import { searchNodes, type SearchResult } from "@/lib/searchApi";

const ROLE_LABEL: Record<string, string> = {
  TOPIC: "Тема",
  CONCEPT: "Понятие",
  METHOD: "Метод",
  SKILL: "Навык",
  TASK: "Задача",
};

type Item = {
  key: string;
  label: string;
  sub?: string;
  icon: string;
  accent?: string;
  run: () => void;
};

export function CommandPalette() {
  const router = useRouter();
  const { toggle } = useTheme();
  const { user } = useAuth();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults([]);
    setActive(0);
  }, []);

  // ⌘K / Ctrl+K toggles the palette
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("mathwin:palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mathwin:palette", onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  // Debounced node search
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (query.trim().length < 2) return;
    timer.current = setTimeout(() => {
      searchNodes(query, 8)
        .then(setResults)
        .catch(() => setResults([]));
    }, 200);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query]);

  const commands = useMemo<Item[]>(() => {
    const go = (href: string) => () => { close(); router.push(href); };
    const list: Item[] = [
      { key: "home", label: "Главная", icon: "⌂", run: go("/") },
      { key: "presets", label: "Программы", sub: "Учебные треки", icon: "◈", run: go("/presets") },
      { key: "roadmap", label: "Граф знаний", sub: "Полный roadmap", icon: "◎", run: go("/roadmap") },
      { key: "route", label: "AI-репетитор", sub: "Маршрут по цели", icon: "✦", run: go("/route") },
      { key: "trial", label: "Записаться на пробное", icon: "→", accent: "var(--accent)", run: go("/#trial") },
      { key: "theme", label: "Переключить тему", icon: "◐", run: () => { toggle(); } },
    ];
    if (user) {
      list.splice(
        4, 0,
        { key: "profile", label: "Профиль", sub: "Прогресс и достижения", icon: "◯", run: go("/profile") },
        { key: "review", label: "Повторение", sub: "Карточки на сегодня", icon: "↻", run: go("/review") },
        { key: "exam", label: "Пробный экзамен", sub: "Вариант с таймером", icon: "✎", run: go("/exam") },
      );
    } else {
      list.push({ key: "auth", label: "Войти", icon: "◉", run: go("/auth") });
    }
    return list;
  }, [router, toggle, user, close]);

  const items = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase();
    const cmds = q
      ? commands.filter((c) => c.label.toLowerCase().includes(q) || c.sub?.toLowerCase().includes(q))
      : commands;
    const nodeItems: Item[] = (q.length >= 2 ? results : []).map((r) => ({
      key: `node:${r.id}`,
      label: r.title,
      sub: ROLE_LABEL[r.role] ?? r.role,
      icon: "·",
      accent: `var(--role-${r.role.toLowerCase()})`,
      run: () => { close(); router.push(`/topic/${encodeURIComponent(r.id)}?track=school&depth=0`); },
    }));
    return [...cmds, ...nodeItems];
  }, [commands, results, query, router, close]);

  const activeIdx = items.length ? Math.min(active, items.length - 1) : 0;

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(Math.min(activeIdx + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(Math.max(activeIdx - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); items[activeIdx]?.run(); }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[12vh]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
            style={{ background: "rgba(3,7,15,0.55)", backdropFilter: "blur(4px)" }}
            onClick={close}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -12 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="relative w-full max-w-lg rounded-2xl overflow-hidden"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", boxShadow: "0 30px 80px -20px rgba(0,0,0,0.6)" }}
          >
            {/* Input */}
            <div className="flex items-center gap-3 px-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <span style={{ color: "var(--text-muted)", fontSize: 15 }}>⌕</span>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActive(0); }}
                onKeyDown={onInputKey}
                placeholder="Команда или поиск по графу…"
                className="flex-1 bg-transparent outline-none py-4 text-sm"
                style={{ color: "var(--text-primary)" }}
              />
              <kbd className="text-[10px] px-1.5 py-0.5 rounded border" style={{ color: "var(--text-muted)", borderColor: "var(--border)" }}>esc</kbd>
            </div>

            {/* Items */}
            <div className="max-h-[52vh] overflow-y-auto py-2">
              {items.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                  Ничего не найдено
                </div>
              ) : (
                items.map((it, i) => {
                  const on = i === activeIdx;
                  return (
                    <button
                      key={it.key}
                      onMouseEnter={() => setActive(i)}
                      onClick={it.run}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                      style={{ background: on ? "var(--accent-subtle)" : "transparent" }}
                    >
                      <span
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs"
                        style={{ background: "var(--bg-input)", color: it.accent ?? "var(--text-muted)" }}
                      >
                        {it.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm truncate" style={{ color: on ? "var(--accent)" : "var(--text-primary)" }}>
                          {it.label}
                        </span>
                        {it.sub && (
                          <span className="block text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{it.sub}</span>
                        )}
                      </span>
                      {on && <span className="text-[11px] shrink-0" style={{ color: "var(--text-muted)" }}>↵</span>}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
