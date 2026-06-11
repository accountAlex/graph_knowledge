"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/providers/AuthProvider";

const PRIMARY_LINKS = [
  { href: "/presets", label: "Программы" },
  { href: "/roadmap", label: "Граф знаний" },
  { href: "/route", label: "AI-репетитор" },
];

const SECONDARY_LINKS = [{ href: "/analytics", label: "Аналитика", icon: "◉" }];

const MOBILE_NAV = [
  { href: "/", label: "Главная", icon: "⌂" },
  { href: "/presets", label: "Программы", icon: "◈" },
  { href: "/route", label: "AI-план", icon: "✦" },
  { href: "/roadmap", label: "Граф", icon: "◎" },
  { href: "/profile", label: "Профиль", icon: "◯" },
];

const dropdownItemVariants = {
  hidden: { opacity: 0, x: -6 },
  visible: (i: number) => ({ opacity: 1, x: 0, transition: { delay: i * 0.04, duration: 0.18 } }),
};

/** Knowledge-graph logo mark */
function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <span
      className="flex items-center justify-center rounded-xl shrink-0"
      style={{
        width: size,
        height: size,
        background: "linear-gradient(140deg, #2f6fff, #1f4fd6)",
        boxShadow: "0 4px 14px -4px rgba(47,111,255,0.6)",
      }}
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none">
        <path d="M6 17L12 6L18 14" stroke="rgba(255,255,255,0.55)" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M12 6L18 14" stroke="rgba(255,255,255,0.55)" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="6" cy="17" r="2.4" fill="#fff" />
        <circle cx="12" cy="6" r="2.4" fill="#fff" />
        <circle cx="18" cy="14" r="2.4" fill="#fff" />
      </svg>
    </span>
  );
}

function Wordmark({ light }: { light?: boolean }) {
  return (
    <span
      className="font-display text-base font-700 tracking-tight"
      style={{ color: light ? "#eaf1fb" : "var(--text-primary)", fontWeight: 700 }}
    >
      Math<span style={{ color: "#5b8cff" }}>Win</span>
    </span>
  );
}

function MoreDropdown({
  links,
  muted,
}: {
  links: { href: string; label: string; icon: string }[];
  muted: string;
}) {
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
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
        style={{ color: open || hasActive ? "var(--accent)" : muted }}
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
            className="absolute right-0 top-full mt-2 rounded-xl overflow-hidden z-50"
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              minWidth: 170,
              boxShadow: "0 16px 40px -12px rgba(0,0,0,0.45)",
              transformOrigin: "top right",
            }}
          >
            {links.map((l, i) => (
              <motion.div key={l.href} custom={i} variants={dropdownItemVariants} initial="hidden" animate="visible">
                <Link
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors hover:bg-[var(--bg-card)]"
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
      style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-hover))", color: "#fff" }}
    >
      {letter}
    </div>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const { user } = useAuth();

  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 32);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isActive = (href: string) => pathname === href;
  const onHero = pathname === "/" && !scrolled;

  // colors that adapt when floating over the dark hero
  const textMuted = onHero ? "rgba(204, 219, 245, 0.78)" : "var(--text-muted)";
  const textStrong = onHero ? "#eaf1fb" : "var(--text-secondary)";

  const adminLinks = [
    ...(user?.role === "COMPOSER" || user?.role === "ADMIN"
      ? [
          { href: "/editor", label: "Редактор", icon: "✎" },
          { href: "/auto-link", label: "AI-связи", icon: "✦" },
        ]
      : []),
    ...(user?.role === "ADMIN" ? [{ href: "/admin", label: "Админ", icon: "⚙" }] : []),
  ];
  const allSecondary = [...SECONDARY_LINKS, ...adminLinks];

  return (
    <>
      {/* ── Desktop / tablet header ── */}
      <header
        className="sticky top-0 z-50 hidden sm:block transition-colors duration-300"
        style={{
          background: onHero ? "transparent" : "var(--bg-glass)",
          backdropFilter: onHero ? "none" : "blur(16px)",
          WebkitBackdropFilter: onHero ? "none" : "blur(16px)",
          borderBottom: `1px solid ${onHero ? "transparent" : "var(--border-subtle)"}`,
        }}
      >
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group shrink-0">
            <motion.div whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.96 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}>
              <LogoMark />
            </motion.div>
            <Wordmark light={onHero} />
          </Link>

          {/* Primary nav */}
          <nav className="flex items-center gap-1">
            {PRIMARY_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="relative px-3.5 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ color: isActive(l.href) ? "var(--accent)" : textStrong }}
              >
                {l.label}
                {isActive(l.href) && (
                  <motion.span
                    layoutId="nav-active-underline"
                    className="absolute left-3.5 right-3.5 -bottom-0.5 h-0.5 rounded-full"
                    style={{ background: "var(--accent)" }}
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
              </Link>
            ))}
            {allSecondary.length > 0 && <MoreDropdown links={allSecondary} muted={textMuted} />}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2.5 shrink-0">
            <motion.button
              onClick={toggle}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ color: textMuted, fontSize: 15 }}
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

            {user ? (
              <Link
                href="/profile"
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all duration-200"
                style={{
                  background: isActive("/profile") ? "var(--accent-subtle)" : "transparent",
                }}
              >
                <Avatar name={user.name} email={user.email} />
                <span className="text-sm font-medium max-w-[120px] truncate hidden md:inline" style={{ color: textStrong }}>
                  {user.name || user.email}
                </span>
              </Link>
            ) : (
              <Link href="/auth" className="text-sm font-medium px-3 py-2 rounded-lg" style={{ color: textStrong }}>
                Войти
              </Link>
            )}

            <Link href="/#trial" className="btn-primary !py-2 !px-4 text-sm">
              Пробное занятие
            </Link>
          </div>
        </div>
      </header>

      {/* ── Mobile top bar ── */}
      <header
        className="sticky top-0 z-50 sm:hidden transition-colors duration-300"
        style={{
          background: onHero ? "transparent" : "var(--bg-glass)",
          backdropFilter: onHero ? "none" : "blur(16px)",
          WebkitBackdropFilter: onHero ? "none" : "blur(16px)",
          borderBottom: `1px solid ${onHero ? "transparent" : "var(--border-subtle)"}`,
        }}
      >
        <div className="px-4 flex items-center justify-between" style={{ height: 56 }}>
          <Link href="/" className="flex items-center gap-2">
            <LogoMark size={28} />
            <Wordmark light={onHero} />
          </Link>

          <div className="flex items-center gap-1.5">
            <motion.button
              onClick={toggle}
              whileTap={{ scale: 0.85 }}
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ color: textMuted, fontSize: 14 }}
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
            <Link href="/#trial" className="btn-primary !py-1.5 !px-3 text-xs">
              Пробное
            </Link>
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
