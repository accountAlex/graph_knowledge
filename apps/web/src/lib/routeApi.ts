const baseUrl = () => {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) throw new Error("NEXT_PUBLIC_API_URL is not set");
  return url;
};

export interface RouteStep {
  topicId: string;
  title: string;
  description: string;
  why: string;
  order: number;
}

export interface LearningRoute {
  goal: string;
  matchedTopicId: string | null;
  matchedTitle: string | null;
  steps: RouteStep[];
  summary: string;
}

export async function buildRoute(goal: string): Promise<LearningRoute> {
  const res = await fetch(`${baseUrl()}/route`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ goal }),
  });
  if (!res.ok) throw new Error("Failed to build route");
  return res.json();
}
