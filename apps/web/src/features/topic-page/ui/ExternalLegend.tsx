"use client";

export function ExternalLegend() {
  return (
    <div style={{ color: "var(--text-muted)" }} className="text-xs space-y-1">
      <div className="flex items-center gap-2">
        <div
          style={{ border: "1px dashed var(--border)" }}
          className="w-4 h-3 rounded-sm"
        />
        <span>External / prerequisite</span>
      </div>
      <div className="flex items-center gap-2">
        <div
          style={{ border: "2px solid var(--accent)" }}
          className="w-4 h-3 rounded-sm"
        />
        <span>Selected node</span>
      </div>
    </div>
  );
}
