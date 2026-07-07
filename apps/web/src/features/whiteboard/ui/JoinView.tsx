"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import { joinBoard } from "@/lib/whiteboardApi";

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{ height: "calc(100vh - 64px)", display: "flex", alignItems: "center", justifyContent: "center" }}
      className="text-sm"
    >
      <div style={{ color: "var(--text-secondary)", textAlign: "center" }}>{children}</div>
    </div>
  );
}

export function JoinView() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const token = useSearchParams().get("token");
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (!user || !token || ran.current) return;
    ran.current = true;
    joinBoard(token)
      .then((r) => router.replace(`/board/${r.id}`))
      .catch((e: Error) => setError(e.message));
  }, [user, token, router]);

  if (loading) return <Centered>Загрузка…</Centered>;
  if (!token) return <Centered>Ссылка не содержит токен.</Centered>;
  if (!user)
    return (
      <Centered>
        <p className="mb-2">Войдите, чтобы открыть доску по ссылке.</p>
        <Link href="/auth" style={{ color: "var(--accent)" }}>
          Войти
        </Link>
        <p className="mt-2" style={{ color: "var(--text-muted)", fontSize: 12 }}>
          После входа снова откройте эту ссылку.
        </p>
      </Centered>
    );
  if (error)
    return (
      <Centered>
        <p className="mb-2">{error}</p>
        <Link href="/boards" style={{ color: "var(--accent)" }}>
          К доскам
        </Link>
      </Centered>
    );
  return <Centered>Открываем доску…</Centered>;
}
