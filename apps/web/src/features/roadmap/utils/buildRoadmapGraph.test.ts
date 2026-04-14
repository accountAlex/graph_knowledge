import { describe, it, expect } from "vitest";
import { buildRoadmapGraph } from "./buildRoadmapGraph";
import type { RoadmapPayload } from "@mathgraph/shared";

function makePayload(overrides?: Partial<RoadmapPayload>): RoadmapPayload {
  return {
    depth: 1,
    track: "school",
    nodes: [
      { id: "t1", title: "Topic A", description: null, role: "TOPIC", parentTopicId: null },
      { id: "t2", title: "Topic B", description: null, role: "TOPIC", parentTopicId: null },
      { id: "c1", title: "Concept 1", description: null, role: "CONCEPT", parentTopicId: "t1" },
      { id: "m1", title: "Method 1", description: null, role: "METHOD", parentTopicId: "t1" },
    ],
    edges: [
      { from: "t1", to: "t2", kind: "PREREQ_REQUIRED" },
      { from: "t1", to: "c1", kind: "CONTAINS" },
      { from: "t1", to: "m1", kind: "CONTAINS" },
    ],
    ...overrides,
  };
}

describe("buildRoadmapGraph", () => {
  it("places topics in layers based on prereq edges", () => {
    const { nodes } = buildRoadmapGraph({
      payload: makePayload(),
      expandedTopics: new Set(),
    });

    const t1 = nodes.find((n) => n.id === "t1")!;
    const t2 = nodes.find((n) => n.id === "t2")!;
    // t1 is in layer 0, t2 in layer 1 → t2 should be below t1
    expect(t2.position.y).toBeGreaterThan(t1.position.y);
  });

  it("only shows topics when nothing is expanded", () => {
    const { nodes } = buildRoadmapGraph({
      payload: makePayload(),
      expandedTopics: new Set(),
    });
    // Only topic nodes, no children
    expect(nodes).toHaveLength(2);
    expect(nodes.every((n) => n.type === "roadmapTopic")).toBe(true);
  });

  it("shows children when topic is expanded", () => {
    const { nodes } = buildRoadmapGraph({
      payload: makePayload(),
      expandedTopics: new Set(["t1"]),
    });
    // 2 topics + 2 children (c1, m1)
    expect(nodes).toHaveLength(4);
    const childNodes = nodes.filter((n) => n.type === "roadmapChild");
    expect(childNodes).toHaveLength(2);
  });

  it("children are positioned below their parent topic", () => {
    const { nodes } = buildRoadmapGraph({
      payload: makePayload(),
      expandedTopics: new Set(["t1"]),
    });
    const t1 = nodes.find((n) => n.id === "t1")!;
    const c1 = nodes.find((n) => n.id === "c1")!;
    const m1 = nodes.find((n) => n.id === "m1")!;
    expect(c1.position.y).toBeGreaterThan(t1.position.y);
    expect(m1.position.y).toBeGreaterThan(t1.position.y);
  });

  it("sorts children by role order (CONCEPT before METHOD)", () => {
    const { nodes } = buildRoadmapGraph({
      payload: makePayload(),
      expandedTopics: new Set(["t1"]),
    });
    const c1 = nodes.find((n) => n.id === "c1")!;
    const m1 = nodes.find((n) => n.id === "m1")!;
    // CONCEPT (order 1) row before METHOD (order 2) row
    expect(c1.position.y).toBeLessThan(m1.position.y);
  });

  it("only includes PREREQ_REQUIRED edges (no CONTAINS)", () => {
    const { edges } = buildRoadmapGraph({
      payload: makePayload(),
      expandedTopics: new Set(),
    });
    expect(edges).toHaveLength(1);
    expect(edges[0].source).toBe("t1");
    expect(edges[0].target).toBe("t2");
  });

  it("handles isolated topics (no edges) without crashing", () => {
    const { nodes } = buildRoadmapGraph({
      payload: {
        depth: 0,
        track: "school",
        nodes: [
          { id: "alone", title: "Alone", description: null, role: "TOPIC", parentTopicId: null },
        ],
        edges: [],
      },
      expandedTopics: new Set(),
    });
    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe("alone");
  });
});
