"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MarkdownContent } from "@/features/graph-view/ui/MarkdownContent";
import { fetchNote, saveNote, deleteNote } from "@/lib/notesApi";

type Props = { nodeId: string };

type Mode = "view" | "edit";

export function NodeNoteEditor({ nodeId }: Props) {
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [mode, setMode] = useState<Mode>("view");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load note when nodeId changes
  useEffect(() => {
    setLoading(true);
    setMode("view");
    fetchNote(nodeId)
      .then((note) => {
        const c = note?.content ?? "";
        setContent(c);
        setSavedContent(c);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [nodeId]);

  // Auto-save with debounce
  const triggerSave = useCallback(
    (value: string) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        if (value === savedContent) return;
        setSaving(true);
        try {
          if (!value.trim()) {
            await deleteNote(nodeId);
            setSavedContent("");
          } else {
            await saveNote(nodeId, value);
            setSavedContent(value);
          }
        } catch { /* ignore */ } finally {
          setSaving(false);
        }
      }, 800);
    },
    [nodeId, savedContent],
  );

  const handleChange = (v: string) => {
    setContent(v);
    triggerSave(v);
  };

  const openEdit = () => {
    setMode("edit");
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const isDirty = content !== savedContent;

  if (loading) {
    return <div className="skeleton h-16 rounded-xl mt-1" />;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          Заметки
        </span>
        <div className="flex items-center gap-1.5">
          {saving && (
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>сохранение...</span>
          )}
          {!saving && savedContent && !isDirty && (
            <span className="text-[10px]" style={{ color: "#10b981" }}>✓ сохранено</span>
          )}
          {mode === "view" ? (
            <button
              onClick={openEdit}
              className="text-[10px] px-2 py-1 rounded-lg transition-colors hover:bg-[var(--bg-input)]"
              style={{ color: "var(--accent)" }}
            >
              {content ? "Изменить" : "+ Добавить"}
            </button>
          ) : (
            <button
              onClick={() => setMode("view")}
              className="text-[10px] px-2 py-1 rounded-lg transition-colors hover:bg-[var(--bg-input)]"
              style={{ color: "var(--text-muted)" }}
            >
              Готово
            </button>
          )}
        </div>
      </div>

      {/* Edit mode */}
      {mode === "edit" && (
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: "1px solid var(--accent)", background: "var(--bg-input)" }}
        >
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Markdown + LaTeX поддерживаются. Например: $x^2 + y^2 = r^2$"
            rows={6}
            className="w-full resize-none bg-transparent text-xs p-3 outline-none leading-relaxed"
            style={{ color: "var(--text-primary)" }}
          />
          <div
            className="px-3 py-1.5 flex items-center justify-between"
            style={{ borderTop: "1px solid var(--border)", color: "var(--text-muted)" }}
          >
            <span className="text-[10px]">Markdown · LaTeX</span>
            {content && (
              <button
                onClick={() => handleChange("")}
                className="text-[10px] transition-colors hover:text-[var(--danger)]"
              >
                Очистить
              </button>
            )}
          </div>
        </div>
      )}

      {/* View mode */}
      {mode === "view" && content && (
        <div
          className="rounded-xl p-3 cursor-pointer transition-colors hover:border-[var(--accent)]"
          style={{ background: "var(--bg-input)", border: "1px solid var(--border)" }}
          onClick={openEdit}
        >
          <MarkdownContent>{content}</MarkdownContent>
        </div>
      )}

      {mode === "view" && !content && (
        <button
          onClick={openEdit}
          className="w-full rounded-xl py-3 text-xs transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          style={{
            border: "1px dashed var(--border)",
            color: "var(--text-muted)",
            background: "transparent",
          }}
        >
          + Добавить заметку к этому узлу
        </button>
      )}
    </div>
  );
}
