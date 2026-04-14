export type { TopicListItem } from "@mathgraph/shared";

import type { TopicListItem } from "@mathgraph/shared";

export async function fetchTopics(params: { track: string; signal?: AbortSignal }) {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) throw new Error("NEXT_PUBLIC_API_URL is not set");

  const url = new URL(`${baseUrl}/topics`);
  url.searchParams.set("track", params.track);

  const res = await fetch(url.toString(), { signal: params.signal });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json()) as TopicListItem[];
}
