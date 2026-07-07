import type {
  WhiteboardSummary,
  WhiteboardDetail,
  WhiteboardMemberInfo,
  WhiteboardRole,
  WhiteboardShareLink,
} from "@mathgraph/shared";
import { apiRefresh } from "./authApi";

export type {
  WhiteboardSummary,
  WhiteboardDetail,
  WhiteboardMemberInfo,
  WhiteboardRole,
  WhiteboardShareLink,
};

const baseUrl = () => {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) throw new Error("NEXT_PUBLIC_API_URL is not set");
  return url;
};

const token = () => (typeof window === "undefined" ? "" : localStorage.getItem("mg-access") ?? "");

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token()}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { message?: string }).message || `Request failed (${res.status})`);
  }
  // DELETE endpoints may return a small ack object; callers ignore it.
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const fetchBoards = () => req<WhiteboardSummary[]>("/whiteboards");

export const createBoard = (title?: string, nodeId?: string) =>
  req<WhiteboardSummary>("/whiteboards", {
    method: "POST",
    body: JSON.stringify({ title, nodeId }),
  });

export const fetchBoard = (id: string) => req<WhiteboardDetail>(`/whiteboards/${id}`);

export const renameBoard = (id: string, title: string) =>
  req<WhiteboardSummary>(`/whiteboards/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });

export const deleteBoard = (id: string) =>
  req<{ deleted: boolean }>(`/whiteboards/${id}`, { method: "DELETE" });

export const addBoardMember = (id: string, email: string, role: WhiteboardRole = "EDITOR") =>
  req<WhiteboardMemberInfo>(`/whiteboards/${id}/members`, {
    method: "POST",
    body: JSON.stringify({ email, role }),
  });

export const updateBoardMember = (id: string, userId: string, role: WhiteboardRole) =>
  req<{ updated: boolean }>(`/whiteboards/${id}/members/${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });

export const removeBoardMember = (id: string, userId: string) =>
  req<{ removed: boolean }>(`/whiteboards/${id}/members/${userId}`, { method: "DELETE" });

export const createShareLink = (id: string, role: WhiteboardRole = "EDITOR") =>
  req<WhiteboardShareLink>(`/whiteboards/${id}/share`, {
    method: "POST",
    body: JSON.stringify({ role }),
  });

export const revokeShareLink = (id: string) =>
  req<{ revoked: boolean }>(`/whiteboards/${id}/share`, { method: "DELETE" });

export const joinBoard = (token: string) =>
  req<{ id: string }>("/whiteboards/join", {
    method: "POST",
    body: JSON.stringify({ token }),
  });

/** Build the shareable URL for a token (points at the /join page). */
export const shareUrlForToken = (token: string) =>
  typeof window === "undefined" ? "" : `${window.location.origin}/join?token=${encodeURIComponent(token)}`;

function jwtExpMs(jwt: string): number | null {
  try {
    const b64 = jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(decodeURIComponent(escape(atob(b64))));
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * Token resolver for the collab provider. Returns the current access token, but
 * refreshes it first if it's within 2 min of expiry — so that a reconnect after
 * the 30-min access-token lifetime re-authenticates instead of being rejected.
 */
export async function getCollabToken(): Promise<string> {
  if (typeof window === "undefined") return "";
  const access = localStorage.getItem("mg-access") ?? "";
  const exp = jwtExpMs(access);
  if (exp && exp - Date.now() < 120_000) {
    const refresh = localStorage.getItem("mg-refresh");
    if (refresh) {
      try {
        const tokens = await apiRefresh(refresh);
        localStorage.setItem("mg-access", tokens.accessToken);
        localStorage.setItem("mg-refresh", tokens.refreshToken);
        return tokens.accessToken;
      } catch {
        // Fall back to the existing token; provider surfaces a real auth failure.
      }
    }
  }
  return access;
}

/** Derive the collab WS URL (`/collab`) from the REST API URL, unless overridden. */
export function collabWsUrl(): string {
  const override = process.env.NEXT_PUBLIC_COLLAB_WS_URL;
  if (override) return override;
  const api = baseUrl();
  return api.replace(/^http/, "ws").replace(/\/$/, "") + "/collab";
}
