import type { ChatMessage, ChatSessionSummary, ChatSession } from "@mathgraph/shared";

export type { ChatMessage, ChatSessionSummary, ChatSession };

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

function authHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("mg-access") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Anonymous ask (no session) ──
export async function askAssistant(
  question: string,
  topicId?: string,
  history?: ChatMessage[],
): Promise<string> {
  const res = await fetch(`${API}/assistant/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, topicId, history }),
  });
  if (!res.ok) throw new Error(`Assistant API error: ${res.status}`);
  const data = await res.json();
  return data.answer;
}

// ── Session-based (authenticated) ──
export async function createSession(topicId?: string): Promise<ChatSession> {
  const res = await fetch(`${API}/assistant/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ topicId }),
  });
  if (!res.ok) throw new Error(`Create session error: ${res.status}`);
  return res.json();
}

export async function listSessions(): Promise<ChatSessionSummary[]> {
  const res = await fetch(`${API}/assistant/sessions`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`List sessions error: ${res.status}`);
  return res.json();
}

export async function getSession(id: string): Promise<ChatSession> {
  const res = await fetch(`${API}/assistant/sessions/${id}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Get session error: ${res.status}`);
  return res.json();
}

export async function deleteSession(id: string): Promise<void> {
  await fetch(`${API}/assistant/sessions/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
}

export async function sendSessionMessage(
  sessionId: string,
  question: string,
): Promise<{ answer: string; messages: ChatMessage[] }> {
  const res = await fetch(`${API}/assistant/sessions/${sessionId}/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) throw new Error(`Send message error: ${res.status}`);
  return res.json();
}
