"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/providers/AuthProvider";
import { apiGetAllUsers, apiUpdateUserRole, type AdminUser } from "@/lib/authApi";

const ROLE_LABELS: Record<string, string> = {
  USER: "Ученик",
  COMPOSER: "Составитель",
  ADMIN: "Админ",
};

const ROLE_COLORS: Record<string, string> = {
  USER: "var(--text-muted)",
  COMPOSER: "var(--accent)",
  ADMIN: "#f59e0b",
};

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const isAdmin = user?.role === "ADMIN";

  const loadUsers = useCallback(async () => {
    try {
      const list = await apiGetAllUsers();
      setUsers(list);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin) {
      router.replace("/");
      return;
    }
    loadUsers();
  }, [authLoading, isAdmin, router, loadUsers]);

  const changeRole = async (userId: string, newRole: string) => {
    setUpdating(userId);
    try {
      const updated = await apiUpdateUserRole(userId, newRole);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    } catch {
      /* ignore */
    } finally {
      setUpdating(null);
    }
  };

  if (authLoading || !isAdmin) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
        <div className="animate-pulse text-sm" style={{ color: "var(--text-muted)" }}>
          Загрузка...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-30 backdrop-blur-xl border-b"
        style={{ background: "var(--bg-glass)", borderColor: "var(--border)" }}
      >
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 group">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm"
                style={{
                  background: "linear-gradient(135deg, var(--accent), var(--accent-hover))",
                  color: "#fff",
                }}
              >
                M
              </div>
              <span className="font-display text-base" style={{ fontWeight: 700 }}>Math<span style={{ color: "#5b8cff" }}>Win</span></span>
            </Link>
            <span className="text-xs font-medium px-2 py-1 rounded-md" style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}>
              Админ-панель
            </span>
          </div>
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            {user?.email}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold">Пользователи</h1>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Всего: {users.length}
          </span>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-16 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {users.map((u) => (
              <div
                key={u.id}
                className="glass-card !p-4 !transform-none flex items-center gap-4"
              >
                {/* Avatar */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                  style={{
                    background: `linear-gradient(135deg, ${ROLE_COLORS[u.role]}33, ${ROLE_COLORS[u.role]}11)`,
                    color: ROLE_COLORS[u.role],
                    border: `1px solid ${ROLE_COLORS[u.role]}44`,
                  }}
                >
                  {(u.name?.[0] || u.email[0]).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {u.name || "Без имени"}
                  </div>
                  <div className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                    {u.email}
                  </div>
                </div>

                {/* Date */}
                <div className="text-xs hidden sm:block" style={{ color: "var(--text-muted)" }}>
                  {new Date(u.createdAt).toLocaleDateString("ru-RU")}
                </div>

                {/* Role selector */}
                <select
                  value={u.role}
                  onChange={(e) => changeRole(u.id, e.target.value)}
                  disabled={updating === u.id || u.id === user?.id}
                  className="text-xs font-medium px-3 py-2 rounded-lg border-none outline-none cursor-pointer transition-opacity"
                  style={{
                    background: "var(--bg-input)",
                    color: ROLE_COLORS[u.role],
                    opacity: updating === u.id ? 0.5 : 1,
                  }}
                >
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
