"use client";

import { useEffect, useRef, useState } from "react";
import "mathlive";
import katex from "katex";

// Quick-insert snippets
const SNIPPETS = [
  { label: "Дробь",       latex: "\\frac{a}{b}" },
  { label: "√",           latex: "\\sqrt{x}" },
  { label: "n√",          latex: "\\sqrt[n]{x}" },
  { label: "Степень",     latex: "x^{n}" },
  { label: "Нижний ind.", latex: "x_{n}" },
  { label: "Сумма",       latex: "\\sum_{i=1}^{n}" },
  { label: "Предел",      latex: "\\lim_{x \\to \\infty}" },
  { label: "Интеграл",    latex: "\\int_{a}^{b}" },
  { label: "∞",           latex: "\\infty" },
  { label: "π",           latex: "\\pi" },
  { label: "≤",           latex: "\\leq" },
  { label: "≥",           latex: "\\geq" },
  { label: "≠",           latex: "\\neq" },
  { label: "≈",           latex: "\\approx" },
  { label: "±",           latex: "\\pm" },
  { label: "·",           latex: "\\cdot" },
  { label: "×",           latex: "\\times" },
  { label: "÷",           latex: "\\div" },
  { label: "∈",           latex: "\\in" },
  { label: "∉",           latex: "\\notin" },
  { label: "Вектор",      latex: "\\vec{a}" },
  { label: "Угол",        latex: "\\angle ABC" },
  { label: "△",           latex: "\\triangle ABC" },
  { label: "D = b²−4ac",  latex: "D = b^{2} - 4ac" },
];

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "math-field": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        value?: string;
      };
    }
  }
}

type Props = {
  onInsert: (latex: string, display: boolean) => void;
  onClose: () => void;
};

export function LaTeXModal({ onInsert, onClose }: Props) {
  const mathFieldRef = useRef<HTMLElement>(null);
  const [latex, setLatex] = useState("\\frac{a}{b}");
  const [display, setDisplay] = useState(false);
  const [preview, setPreview] = useState("");
  const [previewError, setPreviewError] = useState(false);

  // Render preview
  useEffect(() => {
    try {
      const html = katex.renderToString(latex || "\\placeholder{}", {
        displayMode: display,
        throwOnError: true,
      });
      setPreview(html);
      setPreviewError(false);
    } catch {
      setPreviewError(true);
      setPreview("");
    }
  }, [latex, display]);

  // Sync mathlive → state
  useEffect(() => {
    const el = mathFieldRef.current as (HTMLElement & { value: string }) | null;
    if (!el) return;
    const handler = () => setLatex(el.value ?? "");
    el.addEventListener("input", handler);
    return () => el.removeEventListener("input", handler);
  }, []);

  // Set initial value into math-field
  useEffect(() => {
    const el = mathFieldRef.current as (HTMLElement & { value: string }) | null;
    if (el) el.value = latex;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applySnippet = (snip: string) => {
    const el = mathFieldRef.current as (HTMLElement & { value: string; executeCommand?: (cmd: string, arg?: string) => void }) | null;
    if (el) {
      el.value = snip;
      setLatex(snip);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-[560px] rounded-2xl animate-fade-in-scale flex flex-col"
        style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          maxHeight: "85vh",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            Формула LaTeX
          </h3>
          <button onClick={onClose} className="btn-ghost !p-1.5" style={{ color: "var(--text-muted)" }}>✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Quick snippets */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
              Быстрая вставка
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SNIPPETS.map((s) => (
                <button
                  key={s.latex}
                  onClick={() => applySnippet(s.latex)}
                  className="text-[11px] px-2.5 py-1 rounded-lg transition-colors hover:bg-[var(--accent-subtle)]"
                  style={{
                    background: "var(--bg-input)",
                    color: "var(--text-secondary)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* MathLive editor */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
              Редактор формулы
            </div>
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: "1px solid var(--border)", background: "var(--bg-input)" }}
            >
              {/* @ts-expect-error mathlive custom element */}
              <math-field
                ref={mathFieldRef}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "12px 14px",
                  fontSize: "18px",
                  background: "transparent",
                  "--caret-color": "var(--accent)",
                  "--selection-background-color": "var(--accent-subtle)",
                  "--text-color": "var(--text-primary)",
                  "--placeholder-color": "var(--text-muted)",
                } as React.CSSProperties}
              />
            </div>
            <p className="text-[10px] mt-1.5" style={{ color: "var(--text-muted)" }}>
              Кликай и набирай прямо в поле — или вставь LaTeX ниже
            </p>
          </div>

          {/* Raw LaTeX input */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
              LaTeX
            </div>
            <input
              value={latex}
              onChange={(e) => {
                setLatex(e.target.value);
                const el = mathFieldRef.current as (HTMLElement & { value: string }) | null;
                if (el) el.value = e.target.value;
              }}
              className="input-field text-xs w-full font-mono"
              placeholder="\frac{a}{b}"
            />
          </div>

          {/* Preview */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
              Предпросмотр
            </div>
            <div
              className="rounded-xl px-4 py-4 min-h-[52px] flex items-center justify-center"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
            >
              {previewError ? (
                <span className="text-xs" style={{ color: "var(--danger)" }}>
                  Синтаксическая ошибка
                </span>
              ) : (
                <span dangerouslySetInnerHTML={{ __html: preview }} />
              )}
            </div>
          </div>

          {/* Display mode toggle */}
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={display}
              onChange={(e) => setDisplay(e.target.checked)}
              className="rounded"
            />
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Блочная формула ($$…$$) — на отдельной строке, крупнее
            </span>
          </label>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <code className="text-[10px] px-2 py-1 rounded" style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}>
            {display ? `$$${latex}$$` : `$${latex}$`}
          </code>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-ghost text-xs px-4 py-2">Отмена</button>
            <button
              onClick={() => { if (!previewError && latex.trim()) onInsert(latex, display); }}
              disabled={previewError || !latex.trim()}
              className="btn-primary text-xs px-4 py-2 disabled:opacity-40"
            >
              Вставить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
