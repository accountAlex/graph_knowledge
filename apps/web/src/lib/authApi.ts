import type { AuthTokens, AuthUser, AdminUser } from "@mathgraph/shared";

export type { AdminUser };

const baseUrl = () => {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) throw new Error("NEXT_PUBLIC_API_URL is not set");
  return url;
};

export async function apiRegister(email: string, password: string, name?: string, role?: "USER" | "COMPOSER"): Promise<AuthTokens> {
  const res = await fetch(`${baseUrl()}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name, role }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `Registration failed (${res.status})`);
  }
  return res.json();
}

export async function apiLogin(email: string, password: string): Promise<AuthTokens> {
  const res = await fetch(`${baseUrl()}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `Login failed (${res.status})`);
  }
  return res.json();
}

export async function apiRefresh(refreshToken: string): Promise<AuthTokens> {
  const res = await fetch(`${baseUrl()}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) throw new Error("Token refresh failed");
  return res.json();
}

export async function apiGetProfile(accessToken: string): Promise<AuthUser> {
  const res = await fetch(`${baseUrl()}/auth/profile`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Failed to fetch profile");
  return res.json();
}

export async function apiUpdateProfile(name: string): Promise<AuthUser> {
  const res = await fetch(`${baseUrl()}/auth/profile`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("mg-access") ?? ""}`,
    },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error("Failed to update profile");
  return res.json();
}

// ──────── Admin API ────────

function getToken() {
  return localStorage.getItem("mg-access") ?? "";
}

export async function apiGetAllUsers(): Promise<AdminUser[]> {
  const res = await fetch(`${baseUrl()}/auth/users`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Failed to fetch users");
  return res.json();
}

export async function apiUpdateUserRole(userId: string, role: string): Promise<AdminUser> {
  const res = await fetch(`${baseUrl()}/auth/users/${userId}/role`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) throw new Error("Failed to update role");
  return res.json();
}
