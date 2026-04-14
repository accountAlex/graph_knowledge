import { describe, it, expect } from "vitest";
import { buildGraphModel } from "./buildGraphModel";
import type { KgNodeData } from "@/features/graph-view/ui/GraphView";
import type { TopicPagePayload } from "@mathgraph/shared";

function asKgData(data: unknown): KgNodeData {
  return data as KgNodeData;
}

const TOPIC_ID = "topic-1";

function makePayload(overrides?: Partial<TopicPagePayload>): TopicPagePayload {
  return {
    topicId: TOPIC_ID,
    track: "school",
    depth: 2,
    nodes: [
      { id: TOPIC_ID, title: "Topic", description: null, content: null, resources: [], role: "TOPIC", isExternal: false, fipiCode: null },
      { id: "c1", title: "Concept 1", description: null, content: null, resources: [], role: "CONCEPT", isExternal: false, fipiCode: null },
      { id: "c2", title: "Concept 2", description: null, content: null, resources: [], role: "CONCEPT", isExternal: false, fipiCode: null },
      { id: "m1", title: "Method 1", description: null, content: null, resources: [], role: "METHOD", isExternal: false, fipiCode: null },
      { id: "ext1", title: "External", description: null, content: null, resources: [], role: "TOPIC", isExternal: true, fipiCode: null },
    ],
    edges: [
      { from: "ext1", to: TOPIC_ID, kind: "PREREQ_REQUIRED" },
      { from: "c1", to: "m1", kind: "PREREQ_REQUIRED" },
    ],
    slots: [
      { kind: "CORE", state: "visible", minDepthToExpand: 0, totalCount: 2, orderedNodeIds: ["c1", "c2"] },
      { kind: "METHODS", state: "visible", minDepthToExpand: 1, totalCount: 1, orderedNodeIds: ["m1"] },
      { kind: "SKILLS", state: "placeholder", minDepthToExpand: 2, totalCount: 0, orderedNodeIds: [] },
      { kind: "TASKS", state: "placeholder", minDepthToExpand: 3, totalCount: 0, orderedNodeIds: [] },
    ],
    ...overrides,
  };
}

describe("buildGraphModel", () => {
  it("assigns correct rows: external=0, topic=1, core=2, methods=3", () => {
    const { nodes } = buildGraphModel({
      payload: makePayload(),
      mode: "overview",
      selectedNodeId: null,
    });

    const byId = new Map(nodes.map((n) => [n.id, n]));
    // External topics go to row 0 (y ~ 40 + 0*yGap)
    expect(byId.get("ext1")!.position.y).toBeLessThan(byId.get(TOPIC_ID)!.position.y);
    // Topic row 1
    expect(byId.get(TOPIC_ID)!.position.y).toBeLessThan(byId.get("c1")!.position.y);
    // CORE row 2
    expect(byId.get("c1")!.position.y).toBeLessThan(byId.get("m1")!.position.y);
  });

  it("includes all nodes in full mode", () => {
    const { nodes } = buildGraphModel({
      payload: makePayload(),
      mode: "overview",
      selectedNodeId: null,
    });
    const dataNodes = nodes.filter((n) => !n.id.startsWith("__rowlabel_"));
    expect(dataNodes).toHaveLength(5);
  });

  it("filters to one-hop neighbors in focus mode", () => {
    const { nodes } = buildGraphModel({
      payload: makePayload(),
      mode: "focus",
      selectedNodeId: "c1",
    });
    const ids = new Set(nodes.map((n) => n.id));
    // c1 + neighbors (m1, ext is not connected to c1) + topicId always included
    expect(ids.has("c1")).toBe(true);
    expect(ids.has("m1")).toBe(true);
    expect(ids.has(TOPIC_ID)).toBe(true);
    // ext1 not a neighbor of c1
    expect(ids.has("ext1")).toBe(false);
  });

  it("dims non-path nodes in path mode", () => {
    const payload = makePayload({
      edges: [
        { from: "ext1", to: TOPIC_ID, kind: "PREREQ_REQUIRED" },
        { from: "c1", to: "m1", kind: "PREREQ_REQUIRED" },
        { from: TOPIC_ID, to: "c1", kind: "CONTAINS" },
      ],
    });
    const { nodes } = buildGraphModel({
      payload,
      mode: "path",
      selectedNodeId: "m1",
    });
    const byId = new Map(nodes.map((n) => [n.id, n]));
    // path: m1 -> c1 -> topic-1
    expect(asKgData(byId.get("m1")!.data).isDimmed).toBe(false);
    expect(asKgData(byId.get("c1")!.data).isDimmed).toBe(false);
    expect(asKgData(byId.get(TOPIC_ID)!.data).isDimmed).toBe(false);
    // ext1 not on path
    expect(asKgData(byId.get("ext1")!.data).isDimmed).toBe(true);
  });

  it("generates edges only for visible nodes", () => {
    const { edges } = buildGraphModel({
      payload: makePayload(),
      mode: "focus",
      selectedNodeId: "c1",
    });
    // Only c1->m1 edge should be present (ext1 is filtered out)
    expect(edges).toHaveLength(1);
    expect(edges[0].source).toBe("c1");
    expect(edges[0].target).toBe("m1");
  });
});
