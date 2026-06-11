"use client";

import { useEffect, useRef, useCallback } from "react";
import type { ForceGraph3DInstance } from "3d-force-graph";
import {
  Group, Mesh, SphereGeometry,
  MeshBasicMaterial, AdditiveBlending, Color,
} from "three";
import SpriteText from "three-spritetext";

// Jewel-tone palette — vibrant on dark backgrounds, distinct from each other
const ROLE_COLOR_HEX: Record<string, string> = {
  TOPIC:   "#c084fc", // vivid violet  — hero nodes
  CONCEPT: "#22d3ee", // electric cyan  — core concepts
  METHOD:  "#4ade80", // neon mint      — methods
  SKILL:   "#facc15", // golden yellow  — skills
  TASK:    "#fb923c", // warm orange    — tasks (more readable than pink)
};

const ROLE_LABELS: Record<string, string> = {
  TOPIC:   "Тема",
  CONCEPT: "Понятие",
  METHOD:  "Метод",
  SKILL:   "Навык",
  TASK:    "Задача",
};

const ROLE_SIZES: Record<string, number> = {
  TOPIC:   8,
  CONCEPT: 5,
  METHOD:  5,
  SKILL:   4,
  TASK:    4,
};

// Default sphere radius formula used internally by 3d-force-graph
function defaultSphereR(nodeVal: number) {
  return Math.cbrt(nodeVal) * 4;
}

// LOD: camera distance threshold (initial camera z ≈ 800–1200)
const LOD_TITLE_DIST = 1800;
const LOD_BADGE_DIST = 2800;

/** Minimal shape of the OrbitControls object exposed by 3d-force-graph */
type OrbitLike = {
  addEventListener(type: string, handler: () => void): void;
  removeEventListener(type: string, handler: () => void): void;
};

export interface Graph3DNode {
  id: string;
  title: string;
  role: string;
}

export interface Graph3DEdge {
  from: string;
  to: string;
  kind: string;
}

type Props = {
  nodes: Graph3DNode[];
  edges: Graph3DEdge[];
  onSelectNode?: (id: string) => void;
};

export function Graph3DView({ nodes, edges, onSelectNode }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraph3DInstance | null>(null);

  const handleClick = useCallback(
    (node: { id?: string | number }) => {
      if (node.id && onSelectNode) onSelectNode(String(node.id));
    },
    [onSelectNode],
  );

  useEffect(() => {
    if (!containerRef.current) return;

    let mounted = true;
    const nodeObjects = new Map<string, Group>();
    let orbitControls: OrbitLike | null = null;
    let lodHandler: (() => void) | null = null;

    import("3d-force-graph").then(({ default: ForceGraph3D }) => {
      if (!mounted || !containerRef.current) return;

      const graph = new ForceGraph3D(containerRef.current)
        .backgroundColor("rgba(0,0,0,0)")
        .nodeId("id")
        .nodeColor((n) => ROLE_COLOR_HEX[(n as unknown as Graph3DNode).role] || "#a78bfa")
        .nodeVal((n) => ROLE_SIZES[(n as unknown as Graph3DNode).role] || 4)
        .nodeOpacity(1)
        // extend(true): library keeps its default sphere; we add glow + labels on top
        .nodeThreeObjectExtend(true)
        .nodeThreeObject((nodeObj) => {
          const node = nodeObj as unknown as Graph3DNode;
          const color = ROLE_COLOR_HEX[node.role] || "#a78bfa";
          const size = ROLE_SIZES[node.role] || 4;
          const isTopic = node.role === "TOPIC";
          const sphereR = defaultSphereR(size);

          const group = new Group();

          // Glow halo — larger translucent sphere around the default sphere
          const glowMesh = new Mesh(
            new SphereGeometry(sphereR * 2.2, 10, 7),
            new MeshBasicMaterial({
              color: new Color(color),
              transparent: true,
              opacity: 0.28,
              blending: AdditiveBlending,
              depthWrite: false,
            }),
          );
          (glowMesh as unknown as { raycast: () => void }).raycast = () => {};
          group.add(glowMesh);

          // Title label
          const titleSprite = new SpriteText(node.title);
          titleSprite.color = "#ffffff";
          titleSprite.textHeight = isTopic ? 4 : 2.5;
          titleSprite.fontFace = "system-ui, -apple-system, sans-serif";
          titleSprite.fontWeight = isTopic ? "700" : "500";
          titleSprite.backgroundColor = `${color}dd`;
          titleSprite.borderRadius = 4;
          titleSprite.padding = isTopic ? [4, 6] : [2, 4];
          titleSprite.position.y = sphereR + (isTopic ? 12 : 8);
          titleSprite.name = "title";
          group.add(titleSprite);

          // Role badge
          const badgeSprite = new SpriteText(ROLE_LABELS[node.role] || node.role);
          badgeSprite.color = color;
          badgeSprite.textHeight = 1.8;
          badgeSprite.fontFace = "system-ui, -apple-system, sans-serif";
          badgeSprite.fontWeight = "600";
          badgeSprite.backgroundColor = "rgba(0,0,0,0.75)";
          badgeSprite.borderColor = color;
          badgeSprite.borderWidth = 0.5;
          badgeSprite.borderRadius = 3;
          badgeSprite.padding = [1, 3];
          badgeSprite.position.y = sphereR + (isTopic ? 5 : 3);
          badgeSprite.name = "badge";
          group.add(badgeSprite);

          nodeObjects.set(String(node.id), group);
          return group;
        })
        .linkSource("from")
        .linkTarget("to")
        .linkColor((e) =>
          (e as unknown as Graph3DEdge).kind === "CONTAINS"
            ? "rgba(192,132,252,0.55)"   // soft violet — hierarchy
            : "rgba(250,204,21,0.9)",     // vivid gold  — prerequisites
        )
        .linkWidth((e) => ((e as unknown as Graph3DEdge).kind === "CONTAINS" ? 1.2 : 2))
        .linkDirectionalParticles((e) => ((e as unknown as Graph3DEdge).kind === "PREREQ_REQUIRED" ? 3 : 0))
        .linkDirectionalParticleWidth(2.5)
        .linkDirectionalParticleColor(() => "#facc15")
        .linkDirectionalParticleSpeed(0.005)
        .onNodeClick(handleClick)
        .width(containerRef.current.clientWidth)
        .height(containerRef.current.clientHeight);

      graph.graphData({
        nodes: nodes.map((n) => ({ ...n })),
        links: edges.map((e) => ({ ...e })),
      });

      graph.d3Force("charge")?.strength(-180);
      graph.d3Force("link")?.distance((e: Graph3DEdge) =>
        e.kind === "CONTAINS" ? 70 : 130,
      );

      // LOD: update label visibility only when camera moves
      lodHandler = () => {
        const dist = graph.camera().position.length();
        const showTitle = dist < LOD_TITLE_DIST;
        const showBadge = dist < LOD_BADGE_DIST;
        for (const group of nodeObjects.values()) {
          const title = group.getObjectByName("title");
          const badge = group.getObjectByName("badge");
          if (title) title.visible = showTitle;
          if (badge) badge.visible = showBadge;
        }
      };
      orbitControls = graph.controls() as unknown as OrbitLike;
      orbitControls?.addEventListener("change", lodHandler);

      graphRef.current = graph;
    });

    return () => {
      mounted = false;
      if (orbitControls && lodHandler) {
        orbitControls.removeEventListener("change", lodHandler);
      }
      if (graphRef.current) {
        graphRef.current._destructor?.();
        graphRef.current = null;
      }
      nodeObjects.clear();
    };
  }, [nodes, edges, handleClick]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      graphRef.current?.width(el.clientWidth).height(el.clientHeight);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return <div ref={containerRef} className="w-full h-full" />;
}
