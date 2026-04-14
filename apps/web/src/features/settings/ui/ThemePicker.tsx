"use client";

import { useTheme, THEME_LIST } from "@/providers/ThemeProvider";

export function ThemePicker() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex flex-wrap gap-2">
      {THEME_LIST.map((t) => (
        <button
          key={t.id}
          onClick={() => setTheme(t.id)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200"
          style={{
            background: theme === t.id ? "var(--accent-subtle)" : "var(--bg-input)",
            border: theme === t.id ? "1.5px solid var(--accent)" : "1.5px solid var(--border)",
            color: theme === t.id ? "var(--accent)" : "var(--text-secondary)",
            boxShadow: theme === t.id ? "0 0 12px var(--accent-glow)" : "none",
          }}
        >
          <span>{t.icon}</span>
          <span>{t.label}</span>
        </button>
      ))}
    </div>
  );
}
