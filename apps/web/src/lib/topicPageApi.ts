export type {
  TopicNodeRole,
  EdgeKind,
  SlotKind,
  SlotState,
  TopicPageNode,
  TopicPageEdge,
  TopicPageSlot,
  TopicPagePayload,
} from "@mathgraph/shared";

import type { TopicPagePayload } from "@mathgraph/shared";

export async function fetchTopicPage(params: {
  topicId: string;
  track: string;
  depth: number;
  signal?: AbortSignal;
}): Promise<TopicPagePayload> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) throw new Error("NEXT_PUBLIC_API_URL is not set");

  const url = new URL(`${baseUrl}/topic/${params.topicId}/page`);
  url.searchParams.set("track", params.track);
  url.searchParams.set("depth", String(params.depth));

  const res = await fetch(url.toString(), { signal: params.signal });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}
