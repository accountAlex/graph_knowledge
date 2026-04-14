import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Neo4jService } from "../neo4j/neo4j.service";
import { RedisService } from "../redis/redis.service";
import { RoadmapPayload } from "./dto/roadmap.dto";

const ROADMAP_TTL = 300; // 5 min

@Injectable()
export class RoadmapService {
  constructor(
    private prisma: PrismaService,
    private neo: Neo4jService,
    private redis: RedisService,
  ) {}

  async getRoadmap(track: string, depth: number): Promise<RoadmapPayload> {
    const cacheKey = `roadmap:${track}:${depth}`;
    const cached = await this.redis.get<RoadmapPayload>(cacheKey);
    if (cached) return cached;
    const graph = await this.neo.getFullRoadmap(depth);

    const allIds = graph.nodes.map((n) => n.id);

    // Fetch only PUBLISHED nodes from PostgreSQL registry
    const registry = await this.prisma.kgNodeRegistry.findMany({
      where: { id: { in: allIds }, status: "PUBLISHED" },
    });
    const byId = new Map(registry.map((r) => [r.id, r]));

    // Build parentTopicId map from CONTAINS edges
    const parentMap = new Map<string, string>();
    for (const e of graph.edges) {
      if (e.kind === "CONTAINS") {
        parentMap.set(e.to, e.from);
      }
    }

    const publishedIds = new Set(registry.map((r) => r.id));
    const nodes = graph.nodes
      .filter((n) => publishedIds.has(n.id))
      .map((n) => {
        const r = byId.get(n.id)!;
        return {
          id: n.id,
          title: r.title,
          description: r.description ?? null,
          role: n.role as any,
          parentTopicId: parentMap.get(n.id) ?? null,
        };
      });

    const edges = (graph.edges as any[]).filter(
      (e) => publishedIds.has(e.from) && publishedIds.has(e.to),
    );
    const payload: RoadmapPayload = { depth, track, nodes, edges };
    await this.redis.set(cacheKey, payload, ROADMAP_TTL);
    return payload;
  }
}
