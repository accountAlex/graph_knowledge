const baseUrl = () => {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) throw new Error("NEXT_PUBLIC_API_URL is not set");
  return url;
};

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("mg-access") ?? ""}`,
  "Content-Type": "application/json",
});

export interface AnalyticsSummary {
  completedCount: number;
  totalSeen: number;
  activeDays: number;
}

export interface ActivityData {
  activity: Record<string, number>;
  currentStreak: number;
  maxStreak: number;
}

export interface RoleCount {
  role: string;
  count: number;
}

export interface TimelineItem {
  nodeId: string;
  completedAt: string;
  title: string;
  role: string | null;
}

export async function fetchAnalyticsSummary(): Promise<AnalyticsSummary> {
  const res = await fetch(`${baseUrl()}/analytics/summary`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch analytics summary");
  return res.json();
}

export async function fetchAnalyticsActivity(): Promise<ActivityData> {
  const res = await fetch(`${baseUrl()}/analytics/activity`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch analytics activity");
  return res.json();
}

export async function fetchAnalyticsByRole(): Promise<RoleCount[]> {
  const res = await fetch(`${baseUrl()}/analytics/by-role`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch analytics by role");
  return res.json();
}

export async function fetchAnalyticsTimeline(): Promise<TimelineItem[]> {
  const res = await fetch(`${baseUrl()}/analytics/timeline`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch analytics timeline");
  return res.json();
}
