import { BadRequestException, NotFoundException } from "@nestjs/common";

const mockPrisma = {
  kgNodeRegistry: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

jest.mock("../prisma/prisma.service", () => ({
  PrismaService: jest.fn().mockImplementation(() => mockPrisma),
}));

const mockNeo = {
  createNode: jest.fn(),
  updateNodeRole: jest.fn(),
  deleteNode: jest.fn(),
  createEdge: jest.fn(),
  deleteEdge: jest.fn(),
  detectCycle: jest.fn(),
};

const mockRedis = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
  delByPattern: jest.fn().mockResolvedValue(undefined),
};

import { KnowledgeService } from "./knowledge.service";

function createService() {
  return new KnowledgeService(mockPrisma as any, mockNeo as any, mockRedis as any);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("KnowledgeService — Nodes", () => {
  it("creates a node in Prisma and Neo4j", async () => {
    mockPrisma.kgNodeRegistry.create.mockResolvedValue({
      id: "test-id",
      title: "Test",
      role: "CONCEPT",
    });

    const svc = createService();
    const result = await svc.createNode({ title: "Test", role: "CONCEPT" });

    expect(result.title).toBe("Test");
    expect(mockNeo.createNode).toHaveBeenCalledTimes(1);
    expect(mockNeo.createEdge).not.toHaveBeenCalled(); // no parentTopicId
  });

  it("creates CONTAINS edge when parentTopicId is provided", async () => {
    mockPrisma.kgNodeRegistry.create.mockResolvedValue({
      id: "child-id",
      title: "Child",
      role: "METHOD",
    });

    const svc = createService();
    await svc.createNode({
      title: "Child",
      role: "METHOD",
      parentTopicId: "parent-topic",
    });

    expect(mockNeo.createEdge).toHaveBeenCalledWith(
      "parent-topic",
      expect.any(String),
      "CONTAINS",
    );
  });

  it("throws NotFoundException when updating non-existent node", async () => {
    mockPrisma.kgNodeRegistry.findUnique.mockResolvedValue(null);

    const svc = createService();
    await expect(
      svc.updateNode("missing", { title: "New" }),
    ).rejects.toThrow(NotFoundException);
  });

  it("updates title in Prisma and role in Neo4j", async () => {
    mockPrisma.kgNodeRegistry.findUnique.mockResolvedValue({
      id: "n1",
      title: "Old",
      role: "CONCEPT",
    });
    mockPrisma.kgNodeRegistry.update.mockResolvedValue({
      id: "n1",
      title: "New",
      role: "METHOD",
    });

    const svc = createService();
    await svc.updateNode("n1", { title: "New", role: "METHOD" });

    expect(mockPrisma.kgNodeRegistry.update).toHaveBeenCalled();
    expect(mockNeo.updateNodeRole).toHaveBeenCalledWith("n1", "METHOD");
  });

  it("deletes node from Neo4j then Prisma", async () => {
    mockPrisma.kgNodeRegistry.findUnique.mockResolvedValue({ id: "n1" });
    mockPrisma.kgNodeRegistry.delete.mockResolvedValue({ id: "n1" });

    const svc = createService();
    const result = await svc.deleteNode("n1");

    expect(result).toEqual({ deleted: "n1" });
    expect(mockNeo.deleteNode).toHaveBeenCalledWith("n1");
    expect(mockPrisma.kgNodeRegistry.delete).toHaveBeenCalled();
  });

  it("throws NotFoundException when deleting non-existent node", async () => {
    mockPrisma.kgNodeRegistry.findUnique.mockResolvedValue(null);

    const svc = createService();
    await expect(svc.deleteNode("missing")).rejects.toThrow(NotFoundException);
  });
});

describe("KnowledgeService — Edges", () => {
  it("rejects self-referencing edges", async () => {
    const svc = createService();
    await expect(
      svc.createEdge({ from: "A", to: "A", type: "PREREQ_REQUIRED" }),
    ).rejects.toThrow(BadRequestException);
  });

  it("rejects edge when source node not found", async () => {
    mockPrisma.kgNodeRegistry.findUnique
      .mockResolvedValueOnce(null) // from
      .mockResolvedValueOnce({ id: "B" }); // to

    const svc = createService();
    await expect(
      svc.createEdge({ from: "A", to: "B", type: "PREREQ_REQUIRED" }),
    ).rejects.toThrow(NotFoundException);
  });

  it("creates edge and checks for cycles", async () => {
    mockPrisma.kgNodeRegistry.findUnique
      .mockResolvedValueOnce({ id: "A" })
      .mockResolvedValueOnce({ id: "B" });
    mockNeo.detectCycle.mockResolvedValue(null); // no cycle

    const svc = createService();
    const result = await svc.createEdge({
      from: "A",
      to: "B",
      type: "PREREQ_REQUIRED",
    });

    expect(result).toEqual({ from: "A", to: "B", type: "PREREQ_REQUIRED" });
    expect(mockNeo.createEdge).toHaveBeenCalledWith("A", "B", "PREREQ_REQUIRED");
    expect(mockNeo.detectCycle).toHaveBeenCalled();
  });

  it("rolls back edge when cycle detected", async () => {
    mockPrisma.kgNodeRegistry.findUnique
      .mockResolvedValueOnce({ id: "A" })
      .mockResolvedValueOnce({ id: "B" });
    mockNeo.detectCycle.mockResolvedValue("A"); // cycle found

    const svc = createService();
    await expect(
      svc.createEdge({ from: "A", to: "B", type: "PREREQ_REQUIRED" }),
    ).rejects.toThrow(BadRequestException);

    // Edge was created then rolled back
    expect(mockNeo.createEdge).toHaveBeenCalled();
    expect(mockNeo.deleteEdge).toHaveBeenCalledWith("A", "B", "PREREQ_REQUIRED");
  });

  it("skips cycle check for CONTAINS edges", async () => {
    mockPrisma.kgNodeRegistry.findUnique
      .mockResolvedValueOnce({ id: "T" })
      .mockResolvedValueOnce({ id: "C" });

    const svc = createService();
    await svc.createEdge({ from: "T", to: "C", type: "CONTAINS" });

    expect(mockNeo.createEdge).toHaveBeenCalledWith("T", "C", "CONTAINS");
    expect(mockNeo.detectCycle).not.toHaveBeenCalled();
  });

  it("deletes an edge", async () => {
    const svc = createService();
    const result = await svc.deleteEdge("A", "B", "PREREQ_REQUIRED");

    expect(result).toEqual({
      deleted: { from: "A", to: "B", type: "PREREQ_REQUIRED" },
    });
    expect(mockNeo.deleteEdge).toHaveBeenCalledWith("A", "B", "PREREQ_REQUIRED");
  });
});
