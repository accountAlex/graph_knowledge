const base = () => {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) throw new Error("NEXT_PUBLIC_API_URL is not set");
  return url;
};

function token() {
  return localStorage.getItem("mg-access") ?? "";
}

export interface LinkSuggestion {
  fromId: string;
  fromTitle: string;
  fromRole: string;
  toId: string;
  toTitle: string;
  toRole: string;
  similarity: number;
}

export async function fetchSuggestions(): Promise<LinkSuggestion[]> {
  const res = await fetch(`${base()}/auto-link/suggestions`, {
    headers: { Authorization: `Bearer ${token()}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch suggestions (${res.status})`);
  return res.json();
}

export async function approveSuggestion(fromId: string, toId: string): Promise<void> {
  const res = await fetch(`${base()}/auto-link/approve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token()}`,
    },
    body: JSON.stringify({ fromId, toId }),
  });
  if (!res.ok) throw new Error("Failed to approve");
}

export async function rejectSuggestion(fromId: string, toId: string): Promise<void> {
  await fetch(`${base()}/auto-link/reject`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token()}`,
    },
    body: JSON.stringify({ fromId, toId }),
  });
}
