import { NotFoundException } from "@nestjs/common";

// Mock PrismaService before importing the service (avoids Prisma generated client resolution)
const mockPrisma = {
  topicView: { findFirst: jest.fn() },
  kgNodeRegistry: { findMany: jest.fn() },
};

jest.mock("../prisma/prisma.service", () => ({
  PrismaService: jest.fn().mockImplementation(() => mockPrisma),
}));

import { TopicPageService } from "./topic-page.service";

const mockNeo = {
  getFullTopicSubgraph: jest.fn(),
};

const mockRedis = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
  delByPattern: jest.fn().mockResolvedValue(undefined),
};

function createService() {
  return new TopicPageService(mockPrisma as any, mockNeo as any, mockRedis as any);
}

// --- fixtures ---
const TOPIC_ID = "topic-1";
const CONCEPT_ID = "concept-1";
const METHOD_ID = "method-1";

const topicViewFixture = {
  topicId: TOPIC_ID,
  track: "school",
  slots: [
    {
      kind: "CORE",
      minDepthToExpand: 0,
      totalCount: 1,
      orderedNodeIds: [CONCEPT_ID],
      pinned: [{ nodeId: CONCEPT_ID }],
    },
    {
      kind: "METHODS",
      minDepthToExpand: 1,
      totalCount: 1,
      orderedNodeIds: [METHOD_ID],
      pinned: [],
    },
    {
      kind: "SKILLS",
      minDepthToExpand: 2,
      totalCount: 0,
      orderedNodeIds: [],
      pinned: [],
    },
    {
      kind: "TASKS",
      minDepthToExpand: 3,
      totalCount: 0,
      orderedNodeIds: [],
      pinned: [],
    },
  ],
};

const registryFixture = [
  { id: TOPIC_ID, title: "Topic", role: "TOPIC" },
  { id: CONCEPT_ID, title: "Concept", role: "CONCEPT" },
  { id: METHOD_ID, title: "Method", role: "METHOD" },
];

beforeEach(() => {
  jest.clearAllMocks();
});

describe("TopicPageService", () => {
  it("throws NotFoundException when TopicView is missing", async () => {
    mockPrisma.topicView.findFirst.mockResolvedValue(null);
    const svc = createService();
    await expect(svc.getTopicPage("no-such", "school", 0)).rejects.toThrow(
      NotFoundException
    );
  });

  it("returns only topic node at depth=0", async () => {
    mockPrisma.topicView.findFirst.mockResolvedValue(topicViewFixture);
    mockPrisma.kgNodeRegistry.findMany.mockResolvedValue(registryFixture);

    const svc = createService();
    const result = await svc.getTopicPage(TOPIC_ID, "school", 0);

    expect(result.topicId).toBe(TOPIC_ID);
    expect(result.depth).toBe(0);
    // depth=0 → no Neo4j call
    expect(mockNeo.getFullTopicSubgraph).not.toHaveBeenCalled();
    // CORE slot is visible at depth=0, others are placeholders
    const coreSlot = result.slots.find((s) => s.kind === "CORE");
    expect(coreSlot?.state).toBe("visible");
    expect(coreSlot?.orderedNodeIds).toEqual([CONCEPT_ID]);

    const methodsSlot = result.slots.find((s) => s.kind === "METHODS");
    expect(methodsSlot?.state).toBe("placeholder");
    expect(methodsSlot?.orderedNodeIds).toEqual([]);
  });

  it("expands METHODS slot at depth=1 and calls Neo4j", async () => {
    mockPrisma.topicView.findFirst.mockResolvedValue(topicViewFixture);
    mockPrisma.kgNodeRegistry.findMany.mockResolvedValue(registryFixture);
    mockNeo.getFullTopicSubgraph.mockResolvedValue({
      nodes: [
        { id: TOPIC_ID, role: "TOPIC" },
        { id: CONCEPT_ID, role: "CONCEPT" },
        { id: METHOD_ID, role: "METHOD" },
      ],
      edges: [{ from: CONCEPT_ID, to: METHOD_ID, kind: "PREREQ_REQUIRED" }],
    });

    const svc = createService();
    const result = await svc.getTopicPage(TOPIC_ID, "school", 1);

    expect(mockNeo.getFullTopicSubgraph).toHaveBeenCalledWith(TOPIC_ID, 1);

    const methodsSlot = result.slots.find((s) => s.kind === "METHODS");
    expect(methodsSlot?.state).toBe("visible");
    expect(methodsSlot?.orderedNodeIds).toEqual([METHOD_ID]);

    // SKILLS still placeholder
    const skillsSlot = result.slots.find((s) => s.kind === "SKILLS");
    expect(skillsSlot?.state).toBe("placeholder");
  });

  it("marks external nodes correctly", async () => {
    const EXTERNAL_ID = "external-topic";
    mockPrisma.topicView.findFirst.mockResolvedValue(topicViewFixture);
    mockPrisma.kgNodeRegistry.findMany.mockResolvedValue([
      ...registryFixture,
      { id: EXTERNAL_ID, title: "External", role: "TOPIC" },
    ]);
    mockNeo.getFullTopicSubgraph.mockResolvedValue({
      nodes: [
        { id: TOPIC_ID, role: "TOPIC" },
        { id: CONCEPT_ID, role: "CONCEPT" },
        { id: EXTERNAL_ID, role: "TOPIC" },
      ],
      edges: [{ from: EXTERNAL_ID, to: TOPIC_ID, kind: "PREREQ_REQUIRED" }],
    });

    const svc = createService();
    const result = await svc.getTopicPage(TOPIC_ID, "school", 1);

    const topicNode = result.nodes.find((n) => n.id === TOPIC_ID);
    expect(topicNode?.isExternal).toBe(false);

    const conceptNode = result.nodes.find((n) => n.id === CONCEPT_ID);
    expect(conceptNode?.isExternal).toBe(false); // in visible CORE slot

    const externalNode = result.nodes.find((n) => n.id === EXTERNAL_ID);
    expect(externalNode?.isExternal).toBe(true);
  });

  it("returns all 4 slots visible at depth=3", async () => {
    mockPrisma.topicView.findFirst.mockResolvedValue(topicViewFixture);
    mockPrisma.kgNodeRegistry.findMany.mockResolvedValue(registryFixture);
    mockNeo.getFullTopicSubgraph.mockResolvedValue({
      nodes: [{ id: TOPIC_ID, role: "TOPIC" }],
      edges: [],
    });

    const svc = createService();
    const result = await svc.getTopicPage(TOPIC_ID, "school", 3);

    for (const slot of result.slots) {
      expect(slot.state).toBe("visible");
    }
  });
});
