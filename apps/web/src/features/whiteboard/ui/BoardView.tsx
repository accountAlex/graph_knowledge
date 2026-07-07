"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import {
  fetchBoard,
  renameBoard,
  addBoardMember,
  updateBoardMember,
  removeBoardMember,
  createShareLink,
  revokeShareLink,
  shareUrlForToken,
  type WhiteboardDetail,
  type WhiteboardRole,
} from "@/lib/whiteboardApi";
import type { ConnState } from "./WhiteboardCanvas";

const WhiteboardCanvas = dynamic(() => import("./WhiteboardCanvas"), {
  ssr: false,
  loading: () => <Centered>Загрузка холста…</Centered>,
});

const PALETTE = ["#e03131", "#1971c2", "#2f9e44", "#f08c00", "#9c36b5", "#0c8599", "#d6336c"];
function colorFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{ height: "calc(100vh - 64px)", display: "flex", alignItems: "center", justifyContent: "center" }}
      className="text-sm"
    >
      <div style={{ color: "var(--text-secondary)" }}>{children}</div>
    </div>
  );
}

export function BoardView({ boardId }: { boardId: string }) {
  const { user, loading } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [board, setBoard] = useState<WhiteboardDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conn, setConn] = useState<ConnState>("connecting");
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => setToken(localStorage.getItem("mg-access") ?? ""), []);

  const reload = useCallback(() => {
    fetchBoard(boardId)
      .then(setBoard)
      .catch((e: Error) => setError(e.message));
  }, [boardId]);

  useEffect(() => {
    if (user) reload();
  }, [user, reload]);

  if (loading) return <Centered>Загрузка…</Centered>;
  if (!user)
    return (
      <Centered>
        Войдите, чтобы открыть доску.{" "}
        <Link href="/auth" style={{ color: "var(--accent)" }}>
          Войти
        </Link>
      </Centered>
    );
  if (error)
    return (
      <Centered>
        {error}.{" "}
        <Link href="/boards" style={{ color: "var(--accent)" }}>
          К доскам
        </Link>
      </Centered>
    );
  if (!board || token === null) return <Centered>Загрузка доски…</Centered>;

  const readOnly = board.role === "VIEWER";
  const isOwner = board.role === "OWNER";
  const canRename = board.role !== "VIEWER";

  const statusLabel =
    authError ? "нет доступа" : conn === "connected" ? "на связи" : conn === "connecting" ? "подключение…" : "переподключение…";
  const statusColor = authError
    ? "var(--danger)"
    : conn === "connected"
      ? "var(--success)"
      : conn === "connecting"
        ? "var(--warning)"
        : "var(--danger)";

  return (
    <div style={{ height: "calc(100vh - 64px)", display: "flex", flexDirection: "column" }}>
      <BoardHeader
        board={board}
        canRename={canRename}
        isOwner={isOwner}
        statusLabel={statusLabel}
        statusColor={statusColor}
        onRenamed={(b) => setBoard((prev) => (prev ? { ...prev, title: b.title } : prev))}
        onMembersChanged={reload}
      />
      <div style={{ flex: 1, minHeight: 0 }}>
        <WhiteboardCanvas
          boardId={boardId}
          readOnly={readOnly}
          userName={user.name || user.email}
          userColor={colorFor(user.id)}
          onStatusChange={setConn}
          onAuthError={setAuthError}
        />
      </div>
    </div>
  );
}

function BoardHeader({
  board,
  canRename,
  isOwner,
  statusLabel,
  statusColor,
  onRenamed,
  onMembersChanged,
}: {
  board: WhiteboardDetail;
  canRename: boolean;
  isOwner: boolean;
  statusLabel: string;
  statusColor: string;
  onRenamed: (b: { title: string }) => void;
  onMembersChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(board.title);
  const [showMembers, setShowMembers] = useState(false);

  const saveTitle = async () => {
    setEditing(false);
    const next = title.trim();
    if (!next || next === board.title) {
      setTitle(board.title);
      return;
    }
    try {
      const updated = await renameBoard(board.id, next);
      onRenamed(updated);
    } catch {
      setTitle(board.title);
    }
  };

  const roleLabel = board.role === "OWNER" ? "владелец" : board.role === "EDITOR" ? "редактор" : "просмотр";

  return (
    <div
      className="flex items-center gap-3 px-4"
      style={{
        height: 52,
        borderBottom: "1px solid var(--border-subtle)",
        background: "var(--bg-secondary)",
        position: "relative",
        zIndex: 10,
      }}
    >
      <Link href="/boards" className="btn-ghost !py-1.5 !px-2.5 text-sm" style={{ flexShrink: 0 }}>
        ← Доски
      </Link>

      {editing ? (
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveTitle();
            if (e.key === "Escape") {
              setTitle(board.title);
              setEditing(false);
            }
          }}
          className="input-field !py-1 !px-2 text-sm"
          style={{ maxWidth: 320 }}
        />
      ) : (
        <button
          onClick={() => canRename && setEditing(true)}
          className="font-display text-sm font-600 truncate"
          style={{ color: "var(--text-primary)", cursor: canRename ? "text" : "default", maxWidth: 360 }}
          title={canRename ? "Переименовать" : undefined}
        >
          {board.title}
        </button>
      )}

      <span
        className="badge"
        style={{ background: "var(--accent-subtle)", color: "var(--accent)", flexShrink: 0 }}
      >
        {roleLabel}
      </span>

      <span className="text-xs ml-auto flex items-center gap-1.5" style={{ color: "var(--text-muted)", flexShrink: 0 }}>
        <span style={{ width: 7, height: 7, borderRadius: 99, background: statusColor }} />
        {statusLabel}
      </span>

      {isOwner && (
        <div style={{ position: "relative", flexShrink: 0 }}>
          <button onClick={() => setShowMembers((v) => !v)} className="btn-ghost !py-1.5 !px-2.5 text-sm">
            Участники · {board.members.length + 1}
          </button>
          {showMembers && (
            <MembersPanel board={board} onClose={() => setShowMembers(false)} onChanged={onMembersChanged} />
          )}
        </div>
      )}
    </div>
  );
}

function MembersPanel({
  board,
  onClose,
  onChanged,
}: {
  board: WhiteboardDetail;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WhiteboardRole>("EDITOR");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const invite = async () => {
    if (!email.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await addBoardMember(board.id, email.trim(), role);
      setEmail("");
      onChanged();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="glass-card"
      style={{
        position: "absolute",
        right: 0,
        top: "calc(100% + 8px)",
        width: 320,
        padding: 14,
        zIndex: 20,
        boxShadow: "0 16px 40px -12px rgba(0,0,0,0.45)",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="font-display text-sm font-600" style={{ color: "var(--text-primary)" }}>
          Доступ к доске
        </span>
        <button onClick={onClose} className="text-sm" style={{ color: "var(--text-muted)" }}>
          ✕
        </button>
      </div>

      <div className="flex flex-col gap-1.5 mb-3" style={{ maxHeight: 200, overflowY: "auto" }}>
        <MemberRow name={`${board.owner.name || board.owner.email}`} sub="владелец" />
        {board.members.map((m) => (
          <MemberRow
            key={m.userId}
            name={m.user.name || m.user.email}
            sub={m.role === "EDITOR" ? "редактор" : "просмотр"}
            right={
              <div className="flex items-center gap-1">
                <select
                  value={m.role}
                  onChange={async (e) => {
                    await updateBoardMember(board.id, m.userId, e.target.value as WhiteboardRole);
                    onChanged();
                  }}
                  className="input-field !py-0.5 !px-1.5 text-xs"
                >
                  <option value="EDITOR">редактор</option>
                  <option value="VIEWER">просмотр</option>
                </select>
                <button
                  onClick={async () => {
                    await removeBoardMember(board.id, m.userId);
                    onChanged();
                  }}
                  className="text-xs"
                  style={{ color: "var(--danger)" }}
                  title="Убрать"
                >
                  ✕
                </button>
              </div>
            }
          />
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && invite()}
          placeholder="email пользователя"
          className="input-field !py-1.5 !px-2 text-sm"
        />
        <div className="flex gap-1.5">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as WhiteboardRole)}
            className="input-field !py-1.5 !px-2 text-sm"
            style={{ flex: 1 }}
          >
            <option value="EDITOR">редактор</option>
            <option value="VIEWER">просмотр</option>
          </select>
          <button onClick={invite} disabled={busy} className="btn-primary !py-1.5 !px-3 text-sm">
            Пригласить
          </button>
        </div>
        {err && (
          <span className="text-xs" style={{ color: "var(--danger)" }}>
            {err}
          </span>
        )}
      </div>

      <div style={{ height: 1, background: "var(--border-subtle)", margin: "14px 0 12px" }} />
      <ShareSection board={board} onChanged={onChanged} />
    </div>
  );
}

function ShareSection({ board, onChanged }: { board: WhiteboardDetail; onChanged: () => void }) {
  const [role, setRole] = useState<WhiteboardRole>(board.shareRole ?? "EDITOR");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const url = board.shareToken ? shareUrlForToken(board.shareToken) : "";

  const create = async () => {
    setBusy(true);
    try {
      await createShareLink(board.id, role);
      onChanged();
    } finally {
      setBusy(false);
    }
  };
  const revoke = async () => {
    setBusy(true);
    try {
      await revokeShareLink(board.id);
      onChanged();
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-600" style={{ color: "var(--text-secondary)" }}>
        Ссылка-приглашение
      </span>
      {board.shareToken ? (
        <>
          <div className="flex gap-1.5">
            <input readOnly value={url} className="input-field !py-1.5 !px-2 text-xs" style={{ flex: 1 }} />
            <button onClick={copy} className="btn-ghost !py-1.5 !px-2.5 text-xs">
              {copied ? "✓" : "Копировать"}
            </button>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              открывшие ссылку получат роль «{board.shareRole === "EDITOR" ? "редактор" : "просмотр"}»
            </span>
            <button onClick={revoke} disabled={busy} className="text-xs" style={{ color: "var(--danger)" }}>
              Отозвать
            </button>
          </div>
        </>
      ) : (
        <div className="flex gap-1.5">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as WhiteboardRole)}
            className="input-field !py-1.5 !px-2 text-sm"
            style={{ flex: 1 }}
          >
            <option value="EDITOR">редактор</option>
            <option value="VIEWER">просмотр</option>
          </select>
          <button onClick={create} disabled={busy} className="btn-primary !py-1.5 !px-3 text-sm">
            Создать ссылку
          </button>
        </div>
      )}
    </div>
  );
}

function MemberRow({ name, sub, right }: { name: string; sub: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <div className="flex flex-col min-w-0">
        <span className="text-sm truncate" style={{ color: "var(--text-primary)" }}>
          {name}
        </span>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {sub}
        </span>
      </div>
      <div className="ml-auto flex-shrink-0">{right}</div>
    </div>
  );
}
