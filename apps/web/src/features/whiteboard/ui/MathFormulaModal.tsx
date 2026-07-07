"use client";

import { useEffect, useState } from "react";
import { MathInput } from "@/components/MathInput";
import { latexToSvg } from "../lib/mathToSvg";

export function MathFormulaModal({
  initialLatex,
  onSubmit,
  onClose,
}: {
  initialLatex: string;
  onSubmit: (latex: string) => void;
  onClose: () => void;
}) {
  const [latex, setLatex] = useState(initialLatex);
  const [preview, setPreview] = useState("");
  const isEdit = initialLatex.trim().length > 0;

  useEffect(() => {
    if (!latex.trim()) {
      setPreview("");
      return;
    }
    let cancelled = false;
    latexToSvg(latex)
      .then((r) => !cancelled && setPreview(r.svg))
      .catch(() => !cancelled && setPreview(""));
    return () => {
      cancelled = true;
    };
  }, [latex]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(8,12,24,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-card"
        style={{ width: 480, maxWidth: "100%", padding: 20 }}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-base font-600" style={{ color: "var(--text-primary)" }}>
            {isEdit ? "Изменить формулу" : "Вставить формулу"}
          </h3>
          <button onClick={onClose} className="text-sm" style={{ color: "var(--text-muted)" }}>
            ✕
          </button>
        </div>

        <MathInput value={initialLatex} onChange={setLatex} />

        <div
          style={{
            marginTop: 12,
            minHeight: 64,
            borderRadius: 10,
            background: "#ffffff",
            border: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 12,
            overflow: "auto",
          }}
          dangerouslySetInnerHTML={{ __html: preview }}
        />

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="btn-ghost text-sm">
            Отмена
          </button>
          <button
            onClick={() => latex.trim() && onSubmit(latex.trim())}
            disabled={!latex.trim()}
            className="btn-primary text-sm"
            style={{ opacity: latex.trim() ? 1 : 0.5 }}
          >
            {isEdit ? "Сохранить" : "Вставить"}
          </button>
        </div>
      </div>
    </div>
  );
}
