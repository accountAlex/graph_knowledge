export type {
  TopicNodeRole,
  EdgeKind,
  RoadmapNode,
  RoadmapEdge,
  RoadmapPayload,
} from "@mathgraph/shared";

import type { RoadmapPayload } from "@mathgraph/shared";

export async function fetchRoadmap(params: {
  track: string;
  depth: number;
  signal?: AbortSignal;
}): Promise<RoadmapPayload> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) throw new Error("NEXT_PUBLIC_API_URL is not set");

  const url = new URL(`${baseUrl}/roadmap`);
  url.searchParams.set("track", params.track);
  url.searchParams.set("depth", String(params.depth));

  const res = await fetch(url.toString(), { signal: params.signal });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}
