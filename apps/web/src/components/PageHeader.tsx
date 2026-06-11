"use client";

import Link from "next/link";
import { motion } from "framer-motion";

/**
 * Branded header band for internal pages — keeps them visually consistent
 * with the MathWin landing (eyebrow + display heading + subtitle).
 */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  back = "/",
  backLabel = "На главную",
  actions,
}: {
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: string;
  back?: string | null;
  backLabel?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
      {/* soft brand glow */}
      <div
        className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[640px] h-[320px] rounded-full"
        style={{ background: "radial-gradient(circle, var(--accent-glow) 0%, transparent 70%)", opacity: 0.5 }}
      />
      <div className="relative mx-auto max-w-6xl px-5 sm:px-6 pt-10 sm:pt-14 pb-8 sm:pb-10">
        {back && (
          <Link
            href={back}
            className="text-xs inline-flex items-center gap-1.5 transition-colors hover:text-[var(--accent)]"
            style={{ color: "var(--text-muted)" }}
          >
            <span aria-hidden>←</span> {backLabel}
          </Link>
        )}

        <div className="mt-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="eyebrow"
            >
              {eyebrow}
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
              className="font-display mt-3 text-3xl sm:text-4xl lg:text-5xl leading-[1.05]"
              style={{ fontWeight: 700, letterSpacing: "-0.025em", color: "var(--text-primary)" }}
            >
              {title}
            </motion.h1>
            {subtitle && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.18 }}
                className="mt-3 max-w-xl text-sm sm:text-base"
                style={{ color: "var(--text-secondary)" }}
              >
                {subtitle}
              </motion.p>
            )}
          </div>

          {actions && <div className="shrink-0">{actions}</div>}
        </div>
      </div>
    </div>
  );
}
