const baseUrl = () => {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) throw new Error("NEXT_PUBLIC_API_URL is not set");
  return url;
};

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("mg-access") ?? ""}`,
  "Content-Type": "application/json",
});

export interface NodeNote {
  id: string;
  nodeId: string;
  content: string;
  updatedAt: string;
}

export async function fetchNote(nodeId: string): Promise<NodeNote | null> {
  const res = await fetch(`${baseUrl()}/notes/${nodeId}`, { headers: authHeaders() });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to fetch note");
  return res.json();
}

export async function saveNote(nodeId: string, content: string): Promise<NodeNote> {
  const res = await fetch(`${baseUrl()}/notes/${nodeId}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error("Failed to save note");
  return res.json();
}

export async function deleteNote(nodeId: string): Promise<void> {
  await fetch(`${baseUrl()}/notes/${nodeId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
}
