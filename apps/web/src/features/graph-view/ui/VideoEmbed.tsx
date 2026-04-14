"use client";

import { useState } from "react";

type VideoInfo =
  | { platform: "youtube"; embedUrl: string; thumbnailUrl: string; originalUrl: string }
  | { platform: "vk" | "rutube"; embedUrl: string; originalUrl: string };

function parseVideoUrl(url: string): VideoInfo | null {
  try {
    const u = new URL(url);

    // ── YouTube ───────────────────────────────────────────────────────────────
    if (u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be")) {
      let id: string | null = null;
      if (u.hostname.includes("youtu.be")) {
        id = u.pathname.slice(1).split("?")[0];
      } else {
        id = u.searchParams.get("v");
        if (!id) {
          const m = u.pathname.match(/\/(embed|shorts|v)\/([^/?]+)/);
          if (m) id = m[2];
        }
      }
      if (id) {
        return {
          platform: "youtube",
          embedUrl: `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`,
          thumbnailUrl: `https://img.youtube.com/vi/${id}/mqdefault.jpg`,
          originalUrl: url,
        };
      }
    }

    // ── VK Video ──────────────────────────────────────────────────────────────
    // Handles: vk.com/video..., vkvideo.ru/video...
    if (u.hostname.includes("vk.com") || u.hostname.includes("vkvideo.ru")) {
      const m1 = u.pathname.match(/\/video(-?\d+)_(\d+)/);
      if (m1) {
        return {
          platform: "vk",
          embedUrl: `https://vk.com/video_ext.php?oid=${m1[1]}&id=${m1[2]}&hd=2`,
          originalUrl: url,
        };
      }
      const z = u.searchParams.get("z") ?? "";
      const m2 = z.match(/video(-?\d+)_(\d+)/);
      if (m2) {
        return {
          platform: "vk",
          embedUrl: `https://vk.com/video_ext.php?oid=${m2[1]}&id=${m2[2]}&hd=2`,
          originalUrl: url,
        };
      }
    }

    // ── Rutube ────────────────────────────────────────────────────────────────
    if (u.hostname.includes("rutube.ru")) {
      const m = u.pathname.match(/\/video\/([a-f0-9]+)/i);
      if (m) {
        return {
          platform: "rutube",
          embedUrl: `https://rutube.ru/play/embed/${m[1]}`,
          originalUrl: url,
        };
      }
    }
  } catch { /* invalid URL */ }

  return null;
}

const PLATFORM_LABEL: Record<string, string> = {
  youtube: "YouTube",
  vk: "VK Видео",
  rutube: "Rutube",
};

const PLATFORM_COLOR: Record<string, string> = {
  youtube: "#ff0000",
  vk: "#0077ff",
  rutube: "#ff6c00",
};

// ── Play button overlay SVG ───────────────────────────────────────────────────
function PlayButton() {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.35)" }}
    >
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-transform duration-150 group-hover:scale-110"
        style={{ background: "rgba(0,0,0,0.75)", border: "2px solid rgba(255,255,255,0.9)" }}
      >
        <svg className="w-6 h-6 ml-1" fill="white" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
      </div>
    </div>
  );
}

// ── Platform badge (top-left) ─────────────────────────────────────────────────
function PlatformBadge({ platform }: { platform: string }) {
  return (
    <div
      className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-bold text-white"
      style={{ background: PLATFORM_COLOR[platform] ?? "#666" }}
    >
      {PLATFORM_LABEL[platform]}
    </div>
  );
}

// ── The embed player ─────────────────────────────────────────────────────────
function Player({ info, onCollapse }: { info: VideoInfo; onCollapse: () => void }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      <div className="relative" style={{ paddingBottom: "56.25%" /* 16:9 */ }}>
        <iframe
          src={info.embedUrl}
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title={`${PLATFORM_LABEL[info.platform]} video`}
        />
      </div>
      <div
        className="flex items-center justify-between px-3 py-1.5"
        style={{ background: "var(--bg-input)", borderTop: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-1.5">
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: PLATFORM_COLOR[info.platform] }}
          />
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            {PLATFORM_LABEL[info.platform]}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={info.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] transition-colors hover:text-[var(--accent)]"
            style={{ color: "var(--text-muted)" }}
          >
            Открыть ↗
          </a>
          <button
            onClick={onCollapse}
            className="text-[10px] transition-colors hover:text-[var(--danger)]"
            style={{ color: "var(--text-muted)" }}
          >
            Свернуть
          </button>
        </div>
      </div>
    </div>
  );
}

// ── YouTube thumbnail preview ─────────────────────────────────────────────────
function YoutubeThumbnail({
  info,
  onPlay,
}: {
  info: Extract<VideoInfo, { platform: "youtube" }>;
  onPlay: () => void;
}) {
  return (
    <button
      onClick={onPlay}
      className="relative w-full rounded-xl overflow-hidden group"
      style={{ border: "1px solid var(--border)", display: "block" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={info.thumbnailUrl}
        alt="Video thumbnail"
        className="w-full object-cover"
        style={{ aspectRatio: "16/9", display: "block" }}
        loading="lazy"
      />
      <PlayButton />
      <PlatformBadge platform="youtube" />
    </button>
  );
}

// ── VK / Rutube styled preview card ──────────────────────────────────────────
function GenericPreview({
  info,
  onPlay,
}: {
  info: Extract<VideoInfo, { platform: "vk" | "rutube" }>;
  onPlay: () => void;
}) {
  const color = PLATFORM_COLOR[info.platform];
  return (
    <button
      onClick={onPlay}
      className="relative w-full rounded-xl overflow-hidden group flex items-center justify-center"
      style={{
        border: "1px solid var(--border)",
        background: `linear-gradient(135deg, ${color}18, ${color}08)`,
        aspectRatio: "16/9",
      }}
    >
      {/* Platform watermark text */}
      <span
        className="absolute bottom-3 right-3 text-[11px] font-bold opacity-30"
        style={{ color }}
      >
        {PLATFORM_LABEL[info.platform]}
      </span>
      {/* Play button */}
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center shadow-xl transition-transform duration-150 group-hover:scale-110"
        style={{ background: color }}
      >
        <svg className="w-7 h-7 ml-1" fill="white" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
      </div>
      <PlatformBadge platform={info.platform} />
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
type Props = { url: string };

export function VideoEmbed({ url }: Props) {
  const [playing, setPlaying] = useState(false);
  const info = parseVideoUrl(url);

  if (!info) return null;

  if (playing) {
    return (
      <div className="mb-3">
        <Player info={info} onCollapse={() => setPlaying(false)} />
      </div>
    );
  }

  return (
    <div className="mb-3">
      {info.platform === "youtube" ? (
        <YoutubeThumbnail
          info={info}
          onPlay={() => setPlaying(true)}
        />
      ) : (
        <GenericPreview
          info={info as Extract<VideoInfo, { platform: "vk" | "rutube" }>}
          onPlay={() => setPlaying(true)}
        />
      )}
    </div>
  );
}

/** Returns true if the URL is a supported video link */
export function isVideoUrl(url: string): boolean {
  return parseVideoUrl(url) !== null;
}
