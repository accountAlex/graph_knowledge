"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";

type Mode = "login" | "register";

export default function AuthPage() {
  const router = useRouter();
  const { login, register } = useAuth();
  const { theme, toggle } = useTheme();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"USER" | "COMPOSER">("USER");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, password, name || undefined, role);
      }
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Произошла ошибка");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg-primary)" }}>
      <div className="w-full max-w-sm animate-fade-in-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 group">
            <span
              className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
              style={{ background: "linear-gradient(140deg, #2f6fff, #1f4fd6)" }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M6 17L12 6L18 14" stroke="rgba(255,255,255,0.55)" strokeWidth="1.4" strokeLinecap="round" />
                <circle cx="6" cy="17" r="2.4" fill="#fff" />
                <circle cx="12" cy="6" r="2.4" fill="#fff" />
                <circle cx="18" cy="14" r="2.4" fill="#fff" />
              </svg>
            </span>
            <span className="font-display text-xl tracking-tight" style={{ fontWeight: 700 }}>
              Math<span style={{ color: "#5b8cff" }}>Win</span>
            </span>
          </Link>
        </div>

        {/* Card */}
        <div className="glass-card p-6 !transform-none">
          {/* Mode toggle */}
          <div
            className="flex rounded-xl p-1 mb-6"
            style={{ background: "var(--bg-input)" }}
          >
            {(["login", "register"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(null); }}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200"
                style={{
                  background: mode === m ? "var(--accent)" : "transparent",
                  color: mode === m ? "#fff" : "var(--text-muted)",
                  boxShadow: mode === m ? "0 2px 8px var(--accent-glow)" : "none",
                }}
              >
                {m === "login" ? "Вход" : "Регистрация"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <>
                <div className="animate-fade-in">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                    Имя
                  </label>
                  <input
                    className="input-field"
                    placeholder="Иван"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="animate-fade-in">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                    Роль
                  </label>
                  <div
                    className="flex rounded-lg p-0.5"
                    style={{ background: "var(--bg-input)" }}
                  >
                    {([
                      { value: "USER" as const, label: "Ученик" },
                      { value: "COMPOSER" as const, label: "Составитель" },
                    ]).map((r) => (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setRole(r.value)}
                        className="flex-1 py-2 rounded-md text-xs font-medium transition-all duration-200"
                        style={{
                          background: role === r.value ? "var(--accent)" : "transparent",
                          color: role === r.value ? "#fff" : "var(--text-muted)",
                          boxShadow: role === r.value ? "0 2px 8px var(--accent-glow)" : "none",
                        }}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                Email
              </label>
              <input
                className="input-field"
                type="email"
                placeholder="user@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                Пароль
              </label>
              <input
                className="input-field"
                type="password"
                placeholder="Минимум 6 символов"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <div
                className="rounded-xl p-3 text-sm animate-fade-in-scale"
                style={{
                  background: "rgba(248,113,133,0.08)",
                  color: "var(--danger)",
                  border: "1px solid rgba(248,113,133,0.2)",
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? "..."
                : mode === "login"
                ? "Войти"
                : "Зарегистрироваться"}
            </button>
          </form>
        </div>

        {/* Theme toggle */}
        <div className="text-center mt-6">
          <button
            onClick={toggle}
            className="btn-ghost text-xs"
          >
            {theme === "dark" ? "☀️ Светлая тема" : "🌙 Тёмная тема"}
          </button>
        </div>
      </div>
    </main>
  );
}
