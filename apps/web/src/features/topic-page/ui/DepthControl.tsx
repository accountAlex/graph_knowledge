"use client";

export function DepthControl({
  depth,
  onChange,
}: {
  depth: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2, 3, 4].map((d) => (
        <button
          key={d}
          onClick={() => onChange(d)}
          className="w-7 h-7 rounded-lg text-xs font-bold transition-all duration-200 hover:scale-110 active:scale-95"
          style={{
            background: d <= depth
              ? "linear-gradient(135deg, var(--accent), var(--accent-hover))"
              : "var(--bg-card-hover)",
            color: d <= depth ? "#fff" : "var(--text-muted)",
            border: `1px solid ${d <= depth ? "transparent" : "var(--border)"}`,
            boxShadow: d <= depth ? "0 2px 8px var(--accent-glow)" : "none",
          }}
        >
          {d}
        </button>
      ))}
    </div>
  );
}
