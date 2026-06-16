"use client";

import { useEffect, useRef } from "react";

/**
 * Math entry field backed by MathLive's <math-field> web component.
 * Created imperatively so we don't need JSX intrinsic typings, and so it stays
 * fully client-side (the component is registered via a dynamic import on mount).
 * Emits LaTeX via onChange.
 */
export function MathInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (latex: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let field: (HTMLElement & { value: string }) | null = null;
    let cancelled = false;

    import("mathlive").then(() => {
      if (cancelled || !container) return;
      field = document.createElement("math-field") as HTMLElement & { value: string };
      field.value = value;
      field.style.cssText =
        "display:block;width:100%;background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:10px 14px;font-size:18px;color:var(--text-primary);";
      field.addEventListener("input", () => {
        onChangeRef.current(field?.value ?? "");
      });
      container.appendChild(field);
    });

    return () => {
      cancelled = true;
      field?.remove();
    };
    // Field is initialised once; live updates flow through onChangeRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} />;
}
