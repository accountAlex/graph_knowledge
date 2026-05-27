"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/providers/AuthProvider";

const PRIMARY_LINKS = [
  { href: "/route",    label: "AI-маршрут", icon: "✦" },
  { href: "/presets",  label: "Треки",      icon: "◈" },
  { href: "/roadmap",  label: "Roadmap",    icon: "◎" },
];

const SECONDARY_LINKS = [
  { href: "/analytics", label: "Аналитика", icon: "◉" },
];

const MOBILE_NAV = [
  { href: "/",         label: "Главная",    icon: "⌂"  },
  { href: "/presets",  label: "Треки",      icon: "◈"  },
  { href: "/route",    label: "AI-план",    icon: "✦"  },
  { href: "/roadmap",  label: "Roadmap",    icon: "◎"  },
  { href: "/profile",  label: "Профиль",    icon: "◯"  },
];

const dropdownItemVariants = {
  hidden: { opacity: 0, x: -6 },
  visible: (i: number) => ({ opacity: 1, x: 0, transition: { delay: i * 0.04, duration: 0.18 } }),
};

function MoreDropdown({ links }: { links: { href: string; label: string; icon: string }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const hasActive = links.some((l) => pathname === l.href);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors duration-200"
        style={{
          background: open || hasActive ? "var(--accent-subtle)" : "transparent",
          color: open || hasActive ? "var(--accent)" : "var(--text-muted)",
        }}
      >
        Ещё
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          style={{ fontSize: 9, opacity: 0.7, display: "inline-block" }}
        >
          ▼
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -6 }}
            transition={{ type: "spring", stiffness: 450, damping: 30 }}
            className="absolute right-0 top-full mt-1.5 rounded-xl overflow-hidden z-50"
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              minWidth: 160,
              boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
              transformOrigin: "top right",
            }}
          >
            {links.map((l, i) => (
              <motion.div key={l.href} custom={i} variants={dropdownItemVariants} initial="hidden" animate="visible">
                <Link
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-xs transition-colors hover:bg-[var(--bg-card)]"
                  style={{ color: pathname === l.href ? "var(--accent)" : "var(--text-secondary)" }}
                >
                  <span style={{ fontSize: 13 }}>{l.icon}</span>
                  {l.label}
                  {pathname === l.href && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent)" }} />
                  )}
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Avatar({ name, email }: { name?: string | null; email: string }) {
  const letter = (name?.[0] || email[0]).toUpperCase();
  return (
    <div
      className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
      style={{
        background: "linear-gradient(135deg, var(--accent), var(--accent-hover))",
        color: "#fff",
      }}
    >
      {letter}
    </div>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const { user } = useAuth();

  const isActive = (href: string) => pathname === href;

  const adminLinks = [
    ...(user?.role === "COMPOSER" || user?.role === "ADMIN"
      ? [
          { href: "/editor",    label: "Редактор",   icon: "✎" },
          { href: "/auto-link", label: "AI-связи",   icon: "✦" },
        ]
      : []),
    ...(user?.role === "ADMIN"
      ? [{ href: "/admin", label: "Админ", icon: "⚙" }]
      : []),
  ];

  const allSecondary = [...SECONDARY_LINKS, ...adminLinks];

  return (
    <>
      {/* ── Desktop / tablet header ── */}
      <header
        className="sticky top-0 z-50 hidden sm:block"
        style={{
          background: "var(--bg-glass)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group shrink-0">
            <motion.div
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm shadow-lg"
              style={{
                background: "linear-gradient(135deg, var(--accent), var(--accent-hover))",
                color: "#fff",
              }}
            >
              M
            </motion.div>
            <span className="font-bold text-base tracking-tight" style={{ color: "var(--text-primary)" }}>
              MathGraph
            </span>
          </Link>

          {/* Primary nav */}
          <nav className="flex items-center gap-0.5">
            {PRIMARY_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium"
                style={{ color: isActive(l.href) ? "var(--accent)" : "var(--text-muted)" }}
              >
                {isActive(l.href) && (
                  <motion.div
                    layoutId="nav-active-pill"
                    className="absolute inset-0 rounded-xl"
                    style={{ background: "var(--accent-subtle)" }}
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <span className="relative" style={{ fontSize: 12 }}>{l.icon}</span>
                <span className="relative">{l.label}</span>
                {isActive(l.href) && (
                  <span className="relative w-1 h-1 rounded-full" style={{ background: "var(--accent)" }} />
                )}
              </Link>
            ))}

            {allSecondary.length > 0 && <MoreDropdown links={allSecondary} />}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2 shrink-0">
            {user ? (
              <Link
                href="/profile"
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl transition-all duration-200 hover:bg-[var(--bg-card)]"
                style={{
                  background: isActive("/profile") ? "var(--accent-subtle)" : "transparent",
                  outline: isActive("/profile") ? "1px solid var(--accent)" : "none",
                }}
              >
                <Avatar name={user.name} email={user.email} />
                <span className="text-xs font-medium max-w-[120px] truncate hidden md:inline" style={{ color: "var(--text-secondary)" }}>
                  {user.name || user.email}
                </span>
              </Link>
            ) : (
              <Link href="/auth" className="btn-primary !py-1.5 !px-4 text-xs">
                Войти
              </Link>
            )}

            <motion.button
              onClick={toggle}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-[var(--bg-card)]"
              style={{ color: "var(--text-muted)", fontSize: 15 }}
              title={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={theme}
                  initial={{ opacity: 0, rotate: -90, scale: 0.6 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  exit={{ opacity: 0, rotate: 90, scale: 0.6 }}
                  transition={{ duration: 0.18 }}
                >
                  {theme === "dark" ? "☀" : "☾"}
                </motion.span>
              </AnimatePresence>
            </motion.button>
          </div>
        </div>
      </header>

      {/* ── Mobile top bar ── */}
      <header
        className="sticky top-0 z-50 sm:hidden"
        style={{
          background: "var(--bg-glass)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="px-4 flex items-center justify-between" style={{ height: 52 }}>
          <Link href="/" className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs"
              style={{
                background: "linear-gradient(135deg, var(--accent), var(--accent-hover))",
                color: "#fff",
              }}
            >
              M
            </div>
            <span className="font-bold text-sm tracking-tight" style={{ color: "var(--text-primary)" }}>
              MathGraph
            </span>
          </Link>

          <div className="flex items-center gap-1.5">
            {user ? (
              <Link href="/profile">
                <Avatar name={user.name} email={user.email} />
              </Link>
            ) : (
              <Link href="/auth" className="btn-primary !py-1.5 !px-3 text-xs">
                Войти
              </Link>
            )}
            <motion.button
              onClick={toggle}
              whileTap={{ scale: 0.85 }}
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ color: "var(--text-muted)", fontSize: 14 }}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={theme}
                  initial={{ opacity: 0, rotate: -60, scale: 0.7 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  exit={{ opacity: 0, rotate: 60, scale: 0.7 }}
                  transition={{ duration: 0.15 }}
                >
                  {theme === "dark" ? "☀" : "☾"}
                </motion.span>
              </AnimatePresence>
            </motion.button>
          </div>
        </div>
      </header>

      {/* ── Mobile bottom nav ── */}
      <nav
        className="sm:hidden fixed bottom-0 left-0 right-0 z-50"
        style={{
          background: "var(--bg-glass)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderTop: "1px solid var(--border)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div className="flex items-center justify-around px-2 py-2">
          {MOBILE_NAV.map((l) => {
            const active = isActive(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className="relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl min-w-[52px]"
                style={{ color: active ? "var(--accent)" : "var(--text-muted)" }}
              >
                {active && (
                  <motion.div
                    layoutId="mobile-nav-active"
                    className="absolute inset-0 rounded-xl"
                    style={{ background: "var(--accent-subtle)" }}
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <motion.span
                  animate={{ scale: active ? 1.15 : 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  className="relative"
                  style={{ fontSize: 18, lineHeight: 1 }}
                >
                  {l.icon}
                </motion.span>
                <span className="relative" style={{ fontSize: 10, fontWeight: active ? 600 : 400 }}>
                  {l.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
