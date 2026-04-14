import { Injectable, OnModuleDestroy } from "@nestjs/common";
import neo4j, { Driver } from "neo4j-driver";

@Injectable()
export class Neo4jService implements OnModuleDestroy {
  private driver: Driver;

  constructor() {
    this.driver = neo4j.driver(
      process.env.NEO4J_URI!,
      neo4j.auth.basic(process.env.NEO4J_USER!, process.env.NEO4J_PASSWORD!)
    );
  }

  async onModuleDestroy() {
    await this.driver.close();
  }

  async getPrereqSubgraph(topicId: string, maxHops: number) {
    const session = this.driver.session();
    const hops = Math.max(1, Math.min(Math.trunc(maxHops || 1), 10));

    const query = `
      MATCH p=(a:KGNode)-[:PREREQ_REQUIRED*1..${hops}]->(t:KGNode {id:$topicId})
      WITH collect(p) as ps
      UNWIND ps as p1
      UNWIND nodes(p1) as n
      WITH collect(DISTINCT n.id) as nodeIds, ps
      UNWIND ps as p2
      UNWIND relationships(p2) as r
      WITH nodeIds, collect(DISTINCT {from:startNode(r).id, to:endNode(r).id, kind:type(r)}) as edges
      RETURN nodeIds, edges
    `;

    try {
      const res = await session.run(query, { topicId });

      if (res.records.length === 0) {
        return { nodeIds: [topicId], edges: [] as any[] };
      }

      const nodeIds = res.records[0].get("nodeIds") as string[];
      const edges = res.records[0].get("edges") as Array<{ from: string; to: string; kind: string }>;
      const uniq = Array.from(new Set([topicId, ...nodeIds]));
      return { nodeIds: uniq, edges };
    } finally {
      await session.close();
    }
  }

  /**
   * Returns the full subgraph for a topic page:
   * - The topic itself
   * - Its children (via CONTAINS)
   * - Internal PREREQ_REQUIRED edges between children
   * - Upstream prerequisite topics (via PREREQ_REQUIRED, topic-level)
   */
  async getFullTopicSubgraph(topicId: string, maxHops: number) {
    const session = this.driver.session();
    const hops = Math.max(1, Math.min(Math.trunc(maxHops || 1), 10));

    const query = `
      // 1. Get topic's children via CONTAINS
      OPTIONAL MATCH (t:KGNode {id: $topicId})-[:CONTAINS]->(child:KGNode)
      WITH t, collect(DISTINCT child) AS children

      // 2. Get internal PREREQ edges between children
      UNWIND children AS c
      OPTIONAL MATCH (c)-[ir:PREREQ_REQUIRED]->(c2:KGNode)
      WHERE c2 IN children
      WITH t, children,
           collect(DISTINCT CASE WHEN ir IS NOT NULL
             THEN {from: startNode(ir).id, to: endNode(ir).id, kind: 'PREREQ_REQUIRED'}
             ELSE NULL END) AS rawInternal

      // Filter nulls from CASE
      WITH t, children,
           [e IN rawInternal WHERE e IS NOT NULL] AS internalEdges

      // 3. Get upstream prerequisite topics
      OPTIONAL MATCH prereqPath = (upstream:KGNode)-[:PREREQ_REQUIRED*1..${hops}]->(t)
      WHERE upstream.role = 'TOPIC'
      WITH t, children, internalEdges,
           collect(DISTINCT upstream) AS prereqTopics,
           collect(prereqPath) AS prereqPaths

      // 4. Extract topic-level prereq edges
      UNWIND CASE WHEN size(prereqPaths) = 0 THEN [null] ELSE prereqPaths END AS pp
      UNWIND CASE WHEN pp IS NULL THEN [null] ELSE relationships(pp) END AS tr
      WITH t, children, internalEdges, prereqTopics,
           collect(DISTINCT CASE WHEN tr IS NOT NULL
             THEN {from: startNode(tr).id, to: endNode(tr).id, kind: 'PREREQ_REQUIRED'}
             ELSE NULL END) AS rawTopicEdges

      WITH t, children, internalEdges, prereqTopics,
           [e IN rawTopicEdges WHERE e IS NOT NULL] AS topicEdges

      // 5. Build result
      WITH [t] + children + prereqTopics AS allNodes,
           internalEdges + topicEdges AS allEdges
      RETURN [n IN allNodes | {id: n.id, role: n.role}] AS nodes, allEdges AS edges
    `;

    try {
      const res = await session.run(query, { topicId });

      if (res.records.length === 0) {
        return {
          nodes: [{ id: topicId, role: "TOPIC" }],
          edges: [] as Array<{ from: string; to: string; kind: string }>,
        };
      }

      const nodes = res.records[0].get("nodes") as Array<{ id: string; role: string }>;
      const edges = res.records[0].get("edges") as Array<{ from: string; to: string; kind: string }>;

      // Deduplicate nodes
      const seen = new Set<string>();
      const uniqueNodes = nodes.filter((n) => {
        if (seen.has(n.id)) return false;
        seen.add(n.id);
        return true;
      });

      return { nodes: uniqueNodes, edges };
    } finally {
      await session.close();
    }
  }

  /**
   * Returns all prerequisite topic ancestors for a goal topic (topic-level only).
   * Used by StudyPlan to build a topologically-sortable set of topics.
   */
  async getPrereqAncestors(goalTopicId: string, maxHops: number) {
    const session = this.driver.session();
    const hops = Math.max(1, Math.min(Math.trunc(maxHops || 1), 10));

    const query = `
      MATCH path = (a:KGNode)-[:PREREQ_REQUIRED*0..${hops}]->(goal:KGNode {id: $goalTopicId})
      WHERE a.role = 'TOPIC'
      WITH collect(DISTINCT a.id) AS topicIds, collect(path) AS paths
      UNWIND CASE WHEN size(paths) = 0 THEN [null] ELSE paths END AS p
      UNWIND CASE WHEN p IS NULL THEN [null] ELSE relationships(p) END AS r
      WITH topicIds,
           collect(DISTINCT CASE WHEN r IS NOT NULL AND startNode(r).role = 'TOPIC' AND endNode(r).role = 'TOPIC'
             THEN {from: startNode(r).id, to: endNode(r).id}
             ELSE NULL END) AS rawEdges
      RETURN topicIds, [e IN rawEdges WHERE e IS NOT NULL] AS edges
    `;

    try {
      const res = await session.run(query, { goalTopicId });

      if (res.records.length === 0) {
        return { topicIds: [goalTopicId], edges: [] as Array<{ from: string; to: string }> };
      }

      const topicIds = res.records[0].get("topicIds") as string[];
      const edges = res.records[0].get("edges") as Array<{ from: string; to: string }>;
      return { topicIds, edges };
    } finally {
      await session.close();
    }
  }

  /**
   * Checks if the PREREQ_REQUIRED graph contains any cycles.
   * Returns the ID of a node in the cycle, or null if no cycle exists.
   */
  async detectCycle(): Promise<string | null> {
    const session = this.driver.session();

    try {
      const res = await session.run(`
        MATCH (n:KGNode) WHERE EXISTS { (n)-[:PREREQ_REQUIRED*]->(n) }
        RETURN n.id AS cyclicNodeId LIMIT 1
      `);

      if (res.records.length === 0) return null;
      return res.records[0].get("cyclicNodeId") as string;
    } finally {
      await session.close();
    }
  }

  /**
   * Returns the full roadmap graph: all topics + children filtered by depth.
   * depth 0 = topics only, 1 = +CONCEPT, 2 = +METHOD, 3 = +SKILL, 4 = +TASK
   */
  async getFullRoadmap(depth: number) {
    const session = this.driver.session();

    const rolesByDepth: string[][] = [
      ["TOPIC"],
      ["TOPIC", "CONCEPT"],
      ["TOPIC", "CONCEPT", "METHOD"],
      ["TOPIC", "CONCEPT", "METHOD", "SKILL"],
      ["TOPIC", "CONCEPT", "METHOD", "SKILL", "TASK"],
    ];
    const allowedRoles = rolesByDepth[Math.min(Math.max(depth, 0), 4)];

    const query = `
      // 1. Get all nodes with allowed roles
      MATCH (n:KGNode)
      WHERE n.role IN $allowedRoles
      WITH collect(n) AS allNodes

      // 2. Get PREREQ_REQUIRED edges between allowed nodes
      UNWIND allNodes AS a
      OPTIONAL MATCH (a)-[pr:PREREQ_REQUIRED]->(b:KGNode)
      WHERE b.role IN $allowedRoles
      WITH allNodes,
           collect(DISTINCT CASE WHEN pr IS NOT NULL
             THEN {from: a.id, to: b.id, kind: 'PREREQ_REQUIRED'}
             ELSE NULL END) AS rawPrereq

      // 3. Get CONTAINS edges (topic -> child) for allowed children
      UNWIND allNodes AS a2
      OPTIONAL MATCH (a2)-[c:CONTAINS]->(child:KGNode)
      WHERE child.role IN $allowedRoles
      WITH allNodes,
           [e IN rawPrereq WHERE e IS NOT NULL] AS prereqEdges,
           collect(DISTINCT CASE WHEN c IS NOT NULL
             THEN {from: a2.id, to: child.id, kind: 'CONTAINS'}
             ELSE NULL END) AS rawContains

      WITH allNodes,
           prereqEdges + [e IN rawContains WHERE e IS NOT NULL] AS allEdges

      RETURN [n IN allNodes | {id: n.id, role: n.role}] AS nodes, allEdges AS edges
    `;

    try {
      const res = await session.run(query, { allowedRoles });

      if (res.records.length === 0) {
        return { nodes: [] as Array<{ id: string; role: string }>, edges: [] as Array<{ from: string; to: string; kind: string }> };
      }

      const nodes = res.records[0].get("nodes") as Array<{ id: string; role: string }>;
      const edges = res.records[0].get("edges") as Array<{ from: string; to: string; kind: string }>;

      // Deduplicate nodes
      const seen = new Set<string>();
      const uniqueNodes = nodes.filter((n) => {
        if (seen.has(n.id)) return false;
        seen.add(n.id);
        return true;
      });

      return { nodes: uniqueNodes, edges };
    } finally {
      await session.close();
    }
  }

  // ──────────── Export ────────────

  async getAllEdges(): Promise<Array<{ from: string; to: string; type: string }>> {
    const session = this.driver.session();
    try {
      const res = await session.run(`
        MATCH (a:KGNode)-[r]->(b:KGNode)
        RETURN a.id AS from, b.id AS to, type(r) AS type
      `);
      return res.records.map((rec) => ({
        from: rec.get("from") as string,
        to:   rec.get("to") as string,
        type: rec.get("type") as string,
      }));
    } finally {
      await session.close();
    }
  }

  // ──────────── Write operations ────────────

  async createNode(id: string, role: string) {
    const session = this.driver.session();
    try {
      await session.run("CREATE (:KGNode {id: $id, role: $role})", {
        id,
        role,
      });
    } finally {
      await session.close();
    }
  }

  async updateNodeRole(id: string, role: string) {
    const session = this.driver.session();
    try {
      await session.run(
        "MATCH (n:KGNode {id: $id}) SET n.role = $role",
        { id, role },
      );
    } finally {
      await session.close();
    }
  }

  async deleteNode(id: string) {
    const session = this.driver.session();
    try {
      await session.run("MATCH (n:KGNode {id: $id}) DETACH DELETE n", { id });
    } finally {
      await session.close();
    }
  }

  async createEdge(from: string, to: string, type: string) {
    const session = this.driver.session();
    try {
      // Use APOC-free approach: dynamic rel types via CASE
      const query =
        type === "CONTAINS"
          ? `MATCH (a:KGNode {id: $from}), (b:KGNode {id: $to})
             CREATE (a)-[:CONTAINS]->(b)`
          : `MATCH (a:KGNode {id: $from}), (b:KGNode {id: $to})
             CREATE (a)-[:PREREQ_REQUIRED]->(b)`;
      await session.run(query, { from, to });
    } finally {
      await session.close();
    }
  }

  async deleteEdge(from: string, to: string, type: string) {
    const session = this.driver.session();
    try {
      const query =
        type === "CONTAINS"
          ? `MATCH (a:KGNode {id: $from})-[r:CONTAINS]->(b:KGNode {id: $to}) DELETE r`
          : `MATCH (a:KGNode {id: $from})-[r:PREREQ_REQUIRED]->(b:KGNode {id: $to}) DELETE r`;
      await session.run(query, { from, to });
    } finally {
      await session.close();
    }
  }
}
