const baseUrl = () => {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) throw new Error("NEXT_PUBLIC_API_URL is not set");
  return url;
};

export interface SearchResult {
  id: string;
  title: string;
  role: string;
  status: string;
  description: string | null;
  fipiCode: string | null;
  rank: number;
}

export async function searchNodes(q: string, limit = 20): Promise<SearchResult[]> {
  if (!q.trim()) return [];
  const params = new URLSearchParams({ q: q.trim(), limit: String(limit) });
  const res = await fetch(`${baseUrl()}/search?${params}`);
  if (!res.ok) throw new Error("Search failed");
  return res.json();
}
