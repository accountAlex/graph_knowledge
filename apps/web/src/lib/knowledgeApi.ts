import type { KgNodeDetail, CreateNodeDto, UpdateNodeDto, CreateEdgeDto, NodeStatus } from "@mathgraph/shared";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function authHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("mg-access") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Nodes ──

export async function listNodes(role?: string): Promise<KgNodeDetail[]> {
  const q = role ? `?role=${role}` : "";
  const res = await fetch(`${API}/knowledge/nodes${q}`);
  if (!res.ok) throw new Error(`listNodes: ${res.status}`);
  return res.json();
}

export async function getNode(id: string): Promise<KgNodeDetail> {
  const res = await fetch(`${API}/knowledge/nodes/${id}`);
  if (!res.ok) throw new Error(`getNode: ${res.status}`);
  return res.json();
}

export async function createNode(dto: CreateNodeDto): Promise<KgNodeDetail> {
  const res = await fetch(`${API}/knowledge/nodes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(dto),
  });
  if (!res.ok) throw new Error(`createNode: ${res.status}`);
  return res.json();
}

export async function updateNode(id: string, dto: UpdateNodeDto): Promise<KgNodeDetail> {
  const res = await fetch(`${API}/knowledge/nodes/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(dto),
  });
  if (!res.ok) throw new Error(`updateNode: ${res.status}`);
  return res.json();
}

export async function deleteNode(id: string): Promise<void> {
  const res = await fetch(`${API}/knowledge/nodes/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`deleteNode: ${res.status}`);
}

export async function updateNodeStatus(id: string, status: NodeStatus): Promise<KgNodeDetail> {
  const res = await fetch(`${API}/knowledge/nodes/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(`updateNodeStatus: ${res.status}`);
  return res.json();
}

// ── Edges ──

export async function createEdge(dto: CreateEdgeDto): Promise<void> {
  const res = await fetch(`${API}/knowledge/edges`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(dto),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message ?? `createEdge: ${res.status}`);
  }
}

export async function deleteEdge(from: string, to: string, type: string): Promise<void> {
  const res = await fetch(
    `${API}/knowledge/edges?from=${from}&to=${to}&type=${type}`,
    { method: "DELETE", headers: authHeaders() },
  );
  if (!res.ok) throw new Error(`deleteEdge: ${res.status}`);
}
