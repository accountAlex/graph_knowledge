"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { fetchTopicPage, type TopicPagePayload } from "@/lib/topicPageApi";
import { TopicPageLayout } from "@/features/topic-page/ui/TopicPageLayout";
import { useTheme } from "@/providers/ThemeProvider";

function LoadingSkeleton() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center animate-fade-in">
        <div
          className="w-10 h-10 rounded-full border-2 border-t-transparent mx-auto mb-3"
          style={{
            borderColor: "var(--border)",
            borderTopColor: "var(--accent)",
            animation: "spin-slow 1s linear infinite",
          }}
        />
        <div style={{ color: "var(--text-muted)" }} className="text-sm">
          Загрузка графа...
        </div>
      </div>
    </div>
  );
}

export default function TopicPage() {
  const params = useParams();
  const topicIdRaw = params?.topicId;
  const topicId = Array.isArray(topicIdRaw) ? topicIdRaw[0] : topicIdRaw;

  const router = useRouter();
  const search = useSearchParams();
  const { theme, toggle } = useTheme();

  const track = search?.get("track") ?? "school";
  const depth = Number(search?.get("depth") ?? "0");

  const [payload, setPayload] = useState<TopicPagePayload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!topicId) return;
    const ac = new AbortController();

    fetchTopicPage({ topicId, track, depth, signal: ac.signal })
      .then((p) => { setErr(null); setPayload(p); })
      .catch((e) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        if (e?.message?.includes("aborted")) return;
        setErr(e instanceof Error ? e.message : "Unknown error");
      });

    return () => ac.abort();
  }, [topicId, track, depth]);

  const topicTitle = payload?.nodes.find((n) => n.id === topicId)?.title;

  if (!topicId) {
    return (
      <main style={{ background: "var(--bg-primary)" }} className="min-h-screen">
        <LoadingSkeleton />
      </main>
    );
  }

  const onDepthChange = (next: number) => {
    const q = new URLSearchParams();
    q.set("track", track);
    q.set("depth", String(next));
    router.replace(`/topic/${encodeURIComponent(topicId)}?${q.toString()}`);
  };

  return (
    <main
      className="min-h-screen flex flex-col"
      style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}
    >
      {/* ── Header ── */}
      <header
        className="shrink-0 sticky top-0 z-30"
        style={{
          background: "var(--bg-glass)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Breadcrumbs */}
            <nav className="flex items-center gap-1.5 text-xs min-w-0">
              <Link
                href="/"
                className="shrink-0 transition-colors hover:text-[var(--accent)]"
                style={{ color: "var(--text-muted)" }}
              >
                Темы
              </Link>
              <span style={{ color: "var(--text-muted)" }}>/</span>
              <Link
                href="/roadmap"
                className="shrink-0 transition-colors hover:text-[var(--accent)]"
                style={{ color: "var(--text-muted)" }}
              >
                Roadmap
              </Link>
              {topicTitle && (
                <>
                  <span style={{ color: "var(--text-muted)" }}>/</span>
                  <span className="font-display truncate" style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                    {topicTitle}
                  </span>
                </>
              )}
            </nav>

            <span className="badge badge-accent shrink-0">
              depth: {depth}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/roadmap`}
              className="btn-ghost text-xs"
            >
              Roadmap
            </Link>
            <button
              onClick={toggle}
              className="btn-ghost w-9 h-9 !p-0 flex items-center justify-center text-base"
              title={theme === "dark" ? "Light mode" : "Dark mode"}
            >
              {theme === "dark" ? "\u2600\uFE0F" : "\uD83C\uDF19"}
            </button>
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <div className="flex-1 min-h-0 p-4">
        {err && (
          <div
            className="rounded-xl p-4 text-sm mb-4 animate-fade-in-scale"
            style={{
              background: "rgba(248,113,113,0.08)",
              color: "var(--danger)",
              border: "1px solid rgba(248,113,113,0.2)",
            }}
          >
            {err}
          </div>
        )}

        {!payload && !err && <LoadingSkeleton />}

        {payload && (
          <div className="animate-fade-in h-full">
            <TopicPageLayout payload={payload} onDepthChange={onDepthChange} />
          </div>
        )}
      </div>
    </main>
  );
}
