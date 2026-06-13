"use client";

const SHORTCUTS = [
  { keys: ["↑", "↓", "←", "→"], desc: "Навигация по узлам" },
  { keys: ["Tab"], desc: "Следующий узел" },
  { keys: ["Shift+Tab"], desc: "Предыдущий узел" },
  { keys: ["Enter"], desc: "Открыть детали узла" },
  { keys: ["Space"], desc: "Отметить как изучено" },
  { keys: ["+", "]"], desc: "Увеличить depth" },
  { keys: ["-", "["], desc: "Уменьшить depth" },
  { keys: ["Esc"], desc: "Снять выделение" },
  { keys: ["?"], desc: "Показать/скрыть подсказки" },
];

export function KeyboardShortcutsHelp({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <div
        className="w-[340px] rounded-2xl p-5 animate-fade-in-scale"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            Клавиатурные сокращения
          </h3>
          <button onClick={onClose} className="btn-ghost !p-1 text-xs" style={{ color: "var(--text-muted)" }}>
            Esc
          </button>
        </div>

        <div className="space-y-2.5">
          {SHORTCUTS.map((s, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    className="px-2 py-0.5 rounded-md text-[11px] font-mono font-medium"
                    style={{
                      background: "var(--bg-input)",
                      border: "1px solid var(--border)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {k}
                  </kbd>
                ))}
              </div>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {s.desc}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
