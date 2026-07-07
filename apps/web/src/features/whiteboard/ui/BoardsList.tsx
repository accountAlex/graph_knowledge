"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import {
  fetchBoards,
  createBoard,
  deleteBoard,
  type WhiteboardSummary,
} from "@/lib/whiteboardApi";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "только что";
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.floor(h / 24);
  return `${d} дн назад`;
}

const ROLE_LABEL: Record<string, string> = { OWNER: "владелец", EDITOR: "редактор", VIEWER: "просмотр" };

export function BoardsList() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [boards, setBoards] = useState<WhiteboardSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const reload = useCallback(() => {
    fetchBoards()
      .then(setBoards)
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    if (user) reload();
  }, [user, reload]);

  const onCreate = async () => {
    setCreating(true);
    try {
      const board = await createBoard();
      router.push(`/board/${board.id}`);
    } catch (e) {
      setError((e as Error).message);
      setCreating(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Удалить доску? Это действие необратимо.")) return;
    setBoards((prev) => prev?.filter((b) => b.id !== id) ?? null);
    try {
      await deleteBoard(id);
    } catch {
      reload();
    }
  };

  if (loading)
    return <Wrap><p style={{ color: "var(--text-secondary)" }}>Загрузка…</p></Wrap>;

  if (!user)
    return (
      <Wrap>
        <p style={{ color: "var(--text-secondary)" }}>
          Войдите, чтобы создавать и открывать доски.{" "}
          <Link href="/auth" style={{ color: "var(--accent)" }}>
            Войти
          </Link>
        </p>
      </Wrap>
    );

  return (
    <Wrap>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-700" style={{ color: "var(--text-primary)" }}>
            Доски
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Совместные интерактивные холсты — рисуйте и решайте вместе в реальном времени.
          </p>
        </div>
        <button onClick={onCreate} disabled={creating} className="btn-primary text-sm">
          {creating ? "Создаём…" : "+ Новая доска"}
        </button>
      </div>

      {error && (
        <p className="text-sm mb-4" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}

      {boards === null ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Загрузка досок…
        </p>
      ) : boards.length === 0 ? (
        <div
          className="glass-card flex flex-col items-center justify-center text-center"
          style={{ padding: 48, color: "var(--text-muted)" }}
        >
          <p className="text-sm mb-3">Пока нет ни одной доски.</p>
          <button onClick={onCreate} disabled={creating} className="btn-primary text-sm">
            Создать первую
          </button>
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
          {boards.map((b) => (
            <div key={b.id} className="glass-card flex flex-col" style={{ padding: 16 }}>
              <Link href={`/board/${b.id}`} className="flex-1">
                <div
                  style={{
                    height: 96,
                    borderRadius: 10,
                    background: "linear-gradient(135deg, var(--accent-subtle), transparent)",
                    border: "1px solid var(--border-subtle)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 12,
                    fontSize: 28,
                    opacity: 0.8,
                  }}
                >
                  ✎
                </div>
                <div className="font-display text-sm font-600 truncate" style={{ color: "var(--text-primary)" }}>
                  {b.title}
                </div>
              </Link>
              <div className="flex items-center gap-2 mt-2">
                <span className="badge" style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}>
                  {ROLE_LABEL[b.role] ?? b.role}
                </span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {relativeTime(b.updatedAt)}
                </span>
                {b.role === "OWNER" && (
                  <button
                    onClick={() => onDelete(b.id)}
                    className="ml-auto text-xs"
                    style={{ color: "var(--text-muted)" }}
                    title="Удалить"
                  >
                    🗑
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Wrap>
  );
}

function Wrap({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-5xl px-6 py-10">{children}</div>;
}
