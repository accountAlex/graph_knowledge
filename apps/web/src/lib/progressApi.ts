import type { TopicProgress, ProgressSummaryItem } from "@mathgraph/shared";

export type { TopicProgress, ProgressSummaryItem };

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
export async function toggleNodeProgress(nodeId: string): Promise<{ nodeId: string; completed: boolean }> {
  const res = await fetch(`${baseUrl()}/progress/toggle/${nodeId}`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to toggle progress");
  return res.json();
}
