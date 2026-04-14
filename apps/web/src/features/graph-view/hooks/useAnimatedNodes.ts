import { useEffect, useRef, useState } from "react";
import type { Edge, Node } from "reactflow";

const ANIMATION_MS = 400;

/**
 * Smoothly transitions between graph states by:
 * - Keeping exiting nodes briefly (fade out)
 * - Entering nodes start at center then slide to target position
 * - Persisting nodes interpolate to new positions via CSS transition
 */
export function useAnimatedNodes<T extends Record<string, unknown>>(
  targetNodes: Node<T>[],
  targetEdges: Edge[],
) {
  const prevNodesRef = useRef<Map<string, Node<T>>>(new Map());
  const [displayNodes, setDisplayNodes] = useState<Node<T>[]>(targetNodes);
  const [displayEdges, setDisplayEdges] = useState<Edge[]>(targetEdges);
  const [isAnimating, setIsAnimating] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const prevMap = prevNodesRef.current;
    const targetMap = new Map(targetNodes.map((n) => [n.id, n]));

    // First render — no animation
    if (prevMap.size === 0) {
      prevNodesRef.current = targetMap;
      setDisplayNodes(targetNodes);
      setDisplayEdges(targetEdges);
      return;
    }

    // Calculate center of previous graph for entering nodes
    let cx = 400;
    let cy = 200;
    if (prevMap.size > 0) {
      const positions = [...prevMap.values()].map((n) => n.position);
      cx = positions.reduce((s, p) => s + p.x, 0) / positions.length;
      cy = positions.reduce((s, p) => s + p.y, 0) / positions.length;
    }

    // Build merged node list
    const merged: Node<T>[] = [];
    const allIds = new Set([...prevMap.keys(), ...targetMap.keys()]);

    for (const id of allIds) {
      const isEntering = !prevMap.has(id) && targetMap.has(id);
      const isExiting = prevMap.has(id) && !targetMap.has(id);
      const isPersisting = prevMap.has(id) && targetMap.has(id);

      if (isEntering) {
        const target = targetMap.get(id)!;
        // Start at center, CSS transition will slide to target
        merged.push({
          ...target,
          position: { x: cx, y: cy },
          style: { ...((target.style as object) ?? {}), opacity: 0, transition: `all ${ANIMATION_MS}ms ease-out` },
        });
      } else if (isExiting) {
        const prev = prevMap.get(id)!;
        merged.push({
          ...prev,
          style: { ...((prev.style as object) ?? {}), opacity: 0, transition: `opacity ${ANIMATION_MS * 0.6}ms ease-out` },
        });
      } else if (isPersisting) {
        const target = targetMap.get(id)!;
        merged.push({
          ...target,
          style: { ...((target.style as object) ?? {}), transition: `all ${ANIMATION_MS}ms ease-out` },
        });
      }
    }

    setIsAnimating(true);
    setDisplayNodes(merged);
    // Edges: only show edges between target nodes (skip exiting)
    setDisplayEdges(targetEdges);

    // After a tick, move entering nodes to their target positions
    requestAnimationFrame(() => {
      const final: Node<T>[] = [];
      for (const node of merged) {
        const target = targetMap.get(node.id);
        if (target) {
          final.push({
            ...target,
            style: { ...((target.style as object) ?? {}), opacity: 1, transition: `all ${ANIMATION_MS}ms ease-out` },
          });
        } else {
          // exiting — keep fading
          final.push(node);
        }
      }
      setDisplayNodes(final);
    });

    // Cleanup: remove exiting nodes after animation
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      // Clean final state — no transition styles
      setDisplayNodes(targetNodes);
      setDisplayEdges(targetEdges);
      setIsAnimating(false);
      prevNodesRef.current = targetMap;
    }, ANIMATION_MS + 50);

    // Update ref for next comparison
    prevNodesRef.current = targetMap;

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [targetNodes, targetEdges]);

  return { nodes: displayNodes, edges: displayEdges, isAnimating };
}
