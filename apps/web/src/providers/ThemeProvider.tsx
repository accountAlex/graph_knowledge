"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type Theme = "dark" | "light" | "solarized-dark" | "solarized-light" | "high-contrast";

export const THEME_LIST: { id: Theme; label: string; icon: string }[] = [
  { id: "dark", label: "Тёмная", icon: "🌙" },
  { id: "light", label: "Светлая", icon: "☀️" },
  { id: "solarized-dark", label: "Solarized Dark", icon: "🌊" },
  { id: "solarized-light", label: "Solarized Light", icon: "🏖️" },
  { id: "high-contrast", label: "Контрастная", icon: "🔲" },
];

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}>({ theme: "dark", setTheme: () => {}, toggle: () => {} });

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    const saved = localStorage.getItem("mg-theme") as Theme | null;
    if (saved && THEME_LIST.some((t) => t.id === saved)) {
      // Hydration-safe: render the default theme on the server, then apply the
      // persisted choice after mount to avoid a markup mismatch.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setThemeState(saved);
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("mg-theme", theme);
  }, [theme]);

  const setTheme = (t: Theme) => setThemeState(t);

  const toggle = () => {
    const idx = THEME_LIST.findIndex((t) => t.id === theme);
    const next = THEME_LIST[(idx + 1) % THEME_LIST.length];
    setThemeState(next.id);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}
