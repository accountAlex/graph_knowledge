import { useEffect, useState, useCallback } from "react";
import type { Node } from "reactflow";

type Params = {
  nodes: Node[];
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  onDepthChange?: (delta: number) => void;
  onActivate?: () => void;        // Enter — open details for the selected node
  onToggleComplete?: () => void;  // Space — mark/unmark the selected node
};

function isInputFocused() {
  const tag = document.activeElement?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/**
 * Keyboard navigation for graph views.
 * Returns `showHelp` state + setter to toggle the shortcuts overlay.
 */
export function useGraphKeyboardNav({ nodes, selectedNodeId, onSelectNode, onDepthChange, onActivate, onToggleComplete }: Params) {
  const [showHelp, setShowHelp] = useState(false);

  const findNearest = useCallback(
    (direction: "up" | "down" | "left" | "right") => {
      if (!selectedNodeId || nodes.length === 0) return null;
      const current = nodes.find((n) => n.id === selectedNodeId);
      if (!current) return nodes[0]?.id ?? null;

      const { x, y } = current.position;
      let best: string | null = null;
      let bestDist = Infinity;

      for (const n of nodes) {
        if (n.id === selectedNodeId) continue;
        const dx = n.position.x - x;
        const dy = n.position.y - y;

        let valid = false;
        switch (direction) {
          case "up":    valid = dy < -20; break;
          case "down":  valid = dy > 20; break;
          case "left":  valid = dx < -20; break;
          case "right": valid = dx > 20; break;
        }
        if (!valid) continue;

        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < bestDist) {
          bestDist = dist;
          best = n.id;
        }
      }
      return best;
    },
    [nodes, selectedNodeId],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isInputFocused()) return;

      switch (e.key) {
        case "ArrowUp":
        case "ArrowDown":
        case "ArrowLeft":
        case "ArrowRight": {
          e.preventDefault();
          const dir = e.key.replace("Arrow", "").toLowerCase() as "up" | "down" | "left" | "right";
          if (!selectedNodeId && nodes.length > 0) {
            onSelectNode(nodes[0].id);
          } else {
            const next = findNearest(dir);
            if (next) onSelectNode(next);
          }
          break;
        }
        case "Enter":
          if (!selectedNodeId) break;
          e.preventDefault();
          onActivate?.();
          break;
        case " ":
          if (!selectedNodeId) break;
          e.preventDefault();
          onToggleComplete?.();
          break;
        case "Escape":
          e.preventDefault();
          onSelectNode(null);
          setShowHelp(false);
          break;
        case "Tab": {
          e.preventDefault();
          if (nodes.length === 0) break;
          const idx = nodes.findIndex((n) => n.id === selectedNodeId);
          const next = e.shiftKey
            ? (idx - 1 + nodes.length) % nodes.length
            : (idx + 1) % nodes.length;
          onSelectNode(nodes[next].id);
          break;
        }
        case "+":
        case "]":
          e.preventDefault();
          onDepthChange?.(1);
          break;
        case "-":
        case "[":
          e.preventDefault();
          onDepthChange?.(-1);
          break;
        case "?":
          e.preventDefault();
          setShowHelp((p) => !p);
          break;
        default:
          break;
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [nodes, selectedNodeId, onSelectNode, onDepthChange, onActivate, onToggleComplete, findNearest]);

  return { showHelp, setShowHelp };
}
