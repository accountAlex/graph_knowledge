export interface SimpleEdge {
  from: string;
  to: string;
}

/**
 * Kahn's algorithm — topological sort.
 * Returns nodes in dependency order: prerequisites first, goal last.
 * Edge semantics: A → B means "A is prerequisite for B".
 * Throws if the graph contains a cycle.
 */
export function topoSort(nodeIds: string[], edges: SimpleEdge[]): string[] {
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const id of nodeIds) {
    inDegree.set(id, 0);
    adj.set(id, []);
  }

  for (const { from, to } of edges) {
    if (!inDegree.has(from) || !inDegree.has(to)) continue;
    adj.get(from)!.push(to);
    inDegree.set(to, inDegree.get(to)! + 1);
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const sorted: string[] = [];

  while (queue.length) {
    const node = queue.shift()!;
    sorted.push(node);
    for (const neighbor of adj.get(node)!) {
      const newDeg = inDegree.get(neighbor)! - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  if (sorted.length !== nodeIds.length) {
    throw new Error("Cycle detected in prerequisite graph");
  }

  return sorted;
}

/**
 * Returns true if the directed graph contains a cycle.
 */
export function hasCycle(nodeIds: string[], edges: SimpleEdge[]): boolean {
  try {
    topoSort(nodeIds, edges);
    return false;
  } catch {
    return true;
  }
}
