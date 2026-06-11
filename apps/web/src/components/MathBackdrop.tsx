"use client";

import { useEffect, useRef } from "react";

/**
 * Living "knowledge-graph" field rendered on canvas: drifting nodes connected
 * by proximity edges, with a soft parallax toward the cursor. Plus a sparse
 * layer of floating math glyphs. Tuned to sit quietly behind hero content.
 */

const GLYPHS = [
  "∫", "∑", "√", "π", "∞", "∂", "Δ", "≈", "θ", "λ",
  "x²", "sin", "cos", "f(x)", "≤", "→", "²", "∇", "%", "ƒ",
];

type Node = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hot: boolean;
};

export function MathBackdrop({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let nodes: Node[] = [];
    const mouse = { x: 0.5, y: 0.5, active: false };
    const offset = { x: 0, y: 0 };
    let raf = 0;
    let running = true;

    const LINK_DIST = 150;

    function build() {
      const rect = canvas!.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = Math.floor(width * dpr);
      canvas!.height = Math.floor(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      // density scales with area, capped for perf
      const count = Math.min(72, Math.max(26, Math.round((width * height) / 16000)));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        r: Math.random() * 1.6 + 1,
        hot: Math.random() < 0.18,
      }));
    }

    function draw() {
      ctx!.clearRect(0, 0, width, height);

      // ease parallax offset toward target
      const tx = (mouse.x - 0.5) * 26;
      const ty = (mouse.y - 0.5) * 26;
      offset.x += (tx - offset.x) * 0.05;
      offset.y += (ty - offset.y) * 0.05;

      for (const n of nodes) {
        if (!reduce && running) {
          n.x += n.vx;
          n.y += n.vy;
          if (n.x < 0 || n.x > width) n.vx *= -1;
          if (n.y < 0 || n.y > height) n.vy *= -1;
        }
      }

      // edges
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        const ax = a.x + offset.x;
        const ay = a.y + offset.y;
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const bx = b.x + offset.x;
          const by = b.y + offset.y;
          const dx = ax - bx;
          const dy = ay - by;
          const dist = Math.hypot(dx, dy);
          if (dist < LINK_DIST) {
            const alpha = (1 - dist / LINK_DIST) * 0.5;
            ctx!.strokeStyle = `rgba(91, 140, 255, ${alpha * 0.5})`;
            ctx!.lineWidth = 1;
            ctx!.beginPath();
            ctx!.moveTo(ax, ay);
            ctx!.lineTo(bx, by);
            ctx!.stroke();
          }
        }
      }

      // nodes
      for (const n of nodes) {
        const x = n.x + offset.x;
        const y = n.y + offset.y;
        if (n.hot) {
          const g = ctx!.createRadialGradient(x, y, 0, x, y, n.r * 6);
          g.addColorStop(0, "rgba(47, 111, 255, 0.5)");
          g.addColorStop(1, "rgba(47, 111, 255, 0)");
          ctx!.fillStyle = g;
          ctx!.beginPath();
          ctx!.arc(x, y, n.r * 6, 0, Math.PI * 2);
          ctx!.fill();
        }
        ctx!.fillStyle = n.hot
          ? "rgba(120, 165, 255, 0.95)"
          : "rgba(150, 180, 225, 0.5)";
        ctx!.beginPath();
        ctx!.arc(x, y, n.r, 0, Math.PI * 2);
        ctx!.fill();
      }

      raf = requestAnimationFrame(draw);
    }

    function onMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      mouse.x = (e.clientX - rect.left) / rect.width;
      mouse.y = (e.clientY - rect.top) / rect.height;
      mouse.active = true;
    }

    const ro = new ResizeObserver(() => build());
    ro.observe(canvas);
    build();

    const io = new IntersectionObserver(
      ([entry]) => {
        running = entry.isIntersecting;
      },
      { threshold: 0 }
    );
    io.observe(canvas);

    window.addEventListener("mousemove", onMove);
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("mousemove", onMove);
    };
  }, []);

  return (
    <div className={`pointer-events-none absolute inset-0 ${className}`} aria-hidden>
      <canvas ref={canvasRef} className="h-full w-full" />
      <div className="absolute inset-0 overflow-hidden">
        {GLYPHS.map((g, i) => {
          const top = (i * 53) % 92;
          const left = (i * 71) % 94;
          const size = 18 + ((i * 13) % 40);
          const delay = (i % 6) * 0.9;
          const dur = 7 + (i % 5);
          return (
            <span
              key={i}
              className="font-display animate-float absolute select-none"
              style={{
                top: `${top}%`,
                left: `${left}%`,
                fontSize: size,
                color: "rgba(120, 160, 230, 0.10)",
                fontWeight: 600,
                animationDelay: `${delay}s`,
                animationDuration: `${dur}s`,
              }}
            >
              {g}
            </span>
          );
        })}
      </div>
    </div>
  );
}
