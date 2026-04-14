const mockPrisma = {
  kgNodeRegistry: { findMany: jest.fn() },
};

jest.mock("../prisma/prisma.service", () => ({
  PrismaService: jest.fn().mockImplementation(() => mockPrisma),
}));

import { StudyPlanService } from "./study-plan.service";

const mockNeo = {
  getPrereqAncestors: jest.fn(),
};

function createService() {
  return new StudyPlanService(mockNeo as any, mockPrisma as any);
}

beforeEach(() => {
  jest.clearAllMocks();
  // Default: Prisma returns titles matching IDs
  mockPrisma.kgNodeRegistry.findMany.mockImplementation(({ where }: any) => {
    const ids: string[] = where.id.in;
    return Promise.resolve(ids.map((id) => ({ id, title: `Title-${id}` })));
  });
});

describe("StudyPlanService", () => {
  it("returns topologically sorted plan with titles", async () => {
    mockNeo.getPrereqAncestors.mockResolvedValue({
      topicIds: ["A", "B", "C"],
      edges: [
        { from: "A", to: "B" },
        { from: "B", to: "C" },
      ],
    });

    const svc = createService();
    const plan = await svc.generatePlan("C", 5);

    expect(plan).toEqual([
      { id: "A", title: "Title-A" },
      { id: "B", title: "Title-B" },
      { id: "C", title: "Title-C" },
    ]);
    expect(mockNeo.getPrereqAncestors).toHaveBeenCalledWith("C", 5);
  });

  it("returns single topic when no prerequisites", async () => {
    mockNeo.getPrereqAncestors.mockResolvedValue({
      topicIds: ["X"],
      edges: [],
    });

    const svc = createService();
    const plan = await svc.generatePlan("X");

    expect(plan).toEqual([{ id: "X", title: "Title-X" }]);
  });

  it("respects diamond dependencies — goal comes last", async () => {
    mockNeo.getPrereqAncestors.mockResolvedValue({
      topicIds: ["A", "B", "C", "D"],
      edges: [
        { from: "A", to: "B" },
        { from: "A", to: "C" },
        { from: "B", to: "D" },
        { from: "C", to: "D" },
      ],
    });

    const svc = createService();
    const plan = await svc.generatePlan("D", 10);

    expect(plan[0].id).toBe("A");
    expect(plan[plan.length - 1].id).toBe("D");
    expect(plan.findIndex((p) => p.id === "B")).toBeGreaterThan(
      plan.findIndex((p) => p.id === "A"),
    );
  });

  it("throws when Neo4j returns a cycle", async () => {
    mockNeo.getPrereqAncestors.mockResolvedValue({
      topicIds: ["A", "B"],
      edges: [
        { from: "A", to: "B" },
        { from: "B", to: "A" },
      ],
    });

    const svc = createService();
    await expect(svc.generatePlan("B")).rejects.toThrow("Cycle detected");
  });

  it("uses default maxDepth=5", async () => {
    mockNeo.getPrereqAncestors.mockResolvedValue({
      topicIds: ["G"],
      edges: [],
    });

    const svc = createService();
    await svc.generatePlan("G");

    expect(mockNeo.getPrereqAncestors).toHaveBeenCalledWith("G", 5);
  });

  it("falls back to ID when title not found in registry", async () => {
    mockNeo.getPrereqAncestors.mockResolvedValue({
      topicIds: ["A"],
      edges: [],
    });
    mockPrisma.kgNodeRegistry.findMany.mockResolvedValue([]); // no registry entries

    const svc = createService();
    const plan = await svc.generatePlan("A");

    expect(plan).toEqual([{ id: "A", title: "A" }]);
  });
});
