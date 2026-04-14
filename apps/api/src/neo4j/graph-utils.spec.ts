import { topoSort, hasCycle, SimpleEdge } from "./graph-utils";

describe("topoSort", () => {
  it("sorts a linear chain A→B→C", () => {
    const nodes = ["A", "B", "C"];
    const edges: SimpleEdge[] = [
      { from: "A", to: "B" },
      { from: "B", to: "C" },
    ];
    expect(topoSort(nodes, edges)).toEqual(["A", "B", "C"]);
  });

  it("sorts a diamond DAG", () => {
    //   A
    //  / \
    // B   C
    //  \ /
    //   D
    const nodes = ["A", "B", "C", "D"];
    const edges: SimpleEdge[] = [
      { from: "A", to: "B" },
      { from: "A", to: "C" },
      { from: "B", to: "D" },
      { from: "C", to: "D" },
    ];
    const result = topoSort(nodes, edges);
    expect(result[0]).toBe("A");
    expect(result[result.length - 1]).toBe("D");
    expect(result.indexOf("B")).toBeGreaterThan(result.indexOf("A"));
    expect(result.indexOf("C")).toBeGreaterThan(result.indexOf("A"));
  });

  it("returns single node as-is", () => {
    expect(topoSort(["X"], [])).toEqual(["X"]);
  });

  it("handles disconnected components", () => {
    const nodes = ["A", "B", "C"];
    const edges: SimpleEdge[] = [{ from: "A", to: "B" }];
    const result = topoSort(nodes, edges);
    expect(result).toHaveLength(3);
    expect(result.indexOf("A")).toBeLessThan(result.indexOf("B"));
  });

  it("throws on cycle", () => {
    const nodes = ["A", "B", "C"];
    const edges: SimpleEdge[] = [
      { from: "A", to: "B" },
      { from: "B", to: "C" },
      { from: "C", to: "A" },
    ];
    expect(() => topoSort(nodes, edges)).toThrow("Cycle detected");
  });

  it("ignores edges referencing unknown nodes", () => {
    const nodes = ["A", "B"];
    const edges: SimpleEdge[] = [
      { from: "A", to: "B" },
      { from: "X", to: "Y" },
    ];
    expect(topoSort(nodes, edges)).toEqual(["A", "B"]);
  });
});

describe("hasCycle", () => {
  it("returns false for a DAG", () => {
    const nodes = ["A", "B", "C"];
    const edges: SimpleEdge[] = [
      { from: "A", to: "B" },
      { from: "B", to: "C" },
    ];
    expect(hasCycle(nodes, edges)).toBe(false);
  });

  it("returns true when a cycle exists", () => {
    const nodes = ["A", "B"];
    const edges: SimpleEdge[] = [
      { from: "A", to: "B" },
      { from: "B", to: "A" },
    ];
    expect(hasCycle(nodes, edges)).toBe(true);
  });

  it("returns false for empty graph", () => {
    expect(hasCycle([], [])).toBe(false);
  });
});
