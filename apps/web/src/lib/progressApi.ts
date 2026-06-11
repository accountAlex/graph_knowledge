import type {
  TopicProgress,
  ProgressSummaryItem,
  MasteryLevel,
  LearningEvent,
} from "@mathgraph/shared";

export type { TopicProgress, ProgressSummaryItem, MasteryLevel, LearningEvent };

const baseUrl = () => {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) throw new Error("NEXT_PUBLIC_API_URL is not set");
  return url;
};

function getToken() {
  return localStorage.getItem("mg-access") ?? "";
}

const authHeaders = () => ({
  Authorization: `Bearer ${getToken()}`,
  "Content-Type": "application/json",
});

/** Get all completed node IDs */
export async function fetchAllProgress(): Promise<string[]> {
  const res = await fetch(`${baseUrl()}/progress`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch progress");
  return res.json();
}

/** Get progress for specific nodes (e.g. within a topic) */
export async function fetchTopicProgress(nodeIds: string[]): Promise<TopicProgress> {
  const res = await fetch(
    `${baseUrl()}/progress/topic?nodeIds=${nodeIds.join(",")}`,
    { headers: authHeaders() },
  );
  if (!res.ok) throw new Error("Failed to fetch topic progress");
  return res.json();
}

/** Get progress summary per topic */
export async function fetchProgressSummary(): Promise<ProgressSummaryItem[]> {
  const res = await fetch(`${baseUrl()}/progress/summary`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch summary");
  return res.json();
}

/** Toggle a single node's completion */
export async function toggleNodeProgress(nodeId: string): Promise<{ nodeId: string; completed: boolean; mastery: MasteryLevel }> {
  const res = await fetch(`${baseUrl()}/progress/toggle/${nodeId}`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to toggle progress");
  return res.json();
}

/** Nodes that just became learnable (all prerequisites completed) */
export async function fetchUnlocked(): Promise<string[]> {
  const res = await fetch(`${baseUrl()}/progress/unlocked`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch unlocked nodes");
  return res.json();
}

/** Record that the user opened a node (UNSEEN → SEEN) */
export async function recordNodeView(nodeId: string): Promise<void> {
  await fetch(`${baseUrl()}/progress/view/${nodeId}`, {
    method: "POST",
    headers: authHeaders(),
  }).catch(() => {});
}

/** Set a finer-grained mastery level for a node */
export async function setNodeMastery(
  nodeId: string,
  level: MasteryLevel,
  confidence?: number,
): Promise<{ nodeId: string; completed: boolean; mastery: MasteryLevel; confidence: number | null }> {
  const res = await fetch(`${baseUrl()}/progress/mastery/${nodeId}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ level, confidence }),
  });
  if (!res.ok) throw new Error("Failed to set mastery");
  return res.json();
}

/** Recent learning events (activity feed / weekly summary) */
export async function fetchRecentEvents(limit = 50): Promise<LearningEvent[]> {
  const res = await fetch(`${baseUrl()}/progress/events?limit=${limit}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch events");
  return res.json();
}
