const baseUrl = () => {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) throw new Error("NEXT_PUBLIC_API_URL is not set");
  return url;
};

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("mg-access") ?? ""}`,
  "Content-Type": "application/json",
});

export interface ExportGraph {
  version: number;
  exportedAt: string;
  nodes: {
    id: string;
    title: string;
    role: string;
    description?: string;
    content?: string;
    resources: string[];
    fipiCode?: string;
    status: string;
  }[];
  edges: { from: string; to: string; type: string }[];
}

export interface ImportResult {
  nodesCreated: number;
  nodesUpdated: number;
  nodesSkipped: number;
  edgesCreated: number;
  edgesSkipped: number;
  errors: string[];
}

export async function exportGraph(): Promise<ExportGraph> {
  const res = await fetch(`${baseUrl()}/knowledge/export`);
  if (!res.ok) throw new Error("Export failed");
  return res.json();
}

export async function importGraph(
  data: { nodes: unknown[]; edges: unknown[] },
  overwrite = false,
): Promise<ImportResult> {
  const res = await fetch(`${baseUrl()}/knowledge/import`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ ...data, overwrite }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "Import failed");
  }
  return res.json();
}
