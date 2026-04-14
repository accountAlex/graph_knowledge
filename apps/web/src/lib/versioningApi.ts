const baseUrl = () => {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) throw new Error("NEXT_PUBLIC_API_URL is not set");
  return url;
};

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("mg-access") ?? ""}`,
  "Content-Type": "application/json",
});

export interface NodeVersion {
  id: string;
  nodeId: string;
  version: number;
  title: string;
  description: string | null;
  content: string | null;
  resources: string[];
  role: string;
  status: string;
  editedBy: string | null;
  changeNote: string | null;
  createdAt: string;
}

export interface VersionList {
  currentVersion: number;
  versions: NodeVersion[];
}

export async function fetchNodeVersions(nodeId: string): Promise<VersionList> {
  const res = await fetch(`${baseUrl()}/versioning/nodes/${nodeId}/versions`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch versions");
  return res.json();
}

export async function revertNodeToVersion(nodeId: string, version: number): Promise<void> {
  const res = await fetch(
    `${baseUrl()}/versioning/nodes/${nodeId}/revert/${version}`,
    { method: "POST", headers: authHeaders() },
  );
  if (!res.ok) throw new Error("Failed to revert version");
}
