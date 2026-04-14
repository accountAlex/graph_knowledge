import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Neo4jService } from "../neo4j/neo4j.service";
import { RedisService } from "../redis/redis.service";
import { TopicPagePayload } from "./dto/topic-page.dto";

const TOPIC_PAGE_TTL = 120; // 2 min

@Injectable()
export class TopicPageService {
  constructor(
    private prisma: PrismaService,
    private neo: Neo4jService,
    private redis: RedisService,
  ) {}

  async getTopicPage(topicId: string, track: string, depth: number): Promise<TopicPagePayload> {
    const cacheKey = `topic-page:${topicId}:${track}:${depth}`;
    const cached = await this.redis.get<TopicPagePayload>(cacheKey);
    if (cached) return cached;
    const topicView = await this.prisma.topicView.findFirst({
      where: { topicId, track },
      include: { slots: { include: { pinned: true } } },
    });

    if (!topicView) throw new NotFoundException("TopicView not found");

    // слоты всегда 4 — но на всякий случай нормализуем
    const slots = topicView.slots;

    const slotPayload = slots.map((s) => {
      const state = depth >= s.minDepthToExpand ? "visible" : "placeholder";
      return {
        kind: s.kind,
        state,
        minDepthToExpand: s.minDepthToExpand,
        totalCount: s.totalCount,
        orderedNodeIds: state === "visible" ? s.orderedNodeIds : [], // placeholder -> список пустой
      };
    });

    const visibleNodeIds = new Set<string>();
    for (const s of slotPayload) {
      if (s.state === "visible") s.orderedNodeIds.forEach((id) => visibleNodeIds.add(id));
    }

    // Получаем полный подграф из Neo4j (children + prereq topics + внутренние рёбра)
    const maxHops = Math.max(1, depth);
    const graph =
      depth <= 0
        ? { nodes: [{ id: topicId, role: "TOPIC" }], edges: [] as any[] }
        : await this.neo.getFullTopicSubgraph(topicId, maxHops);

    const graphNodeIds = new Set(graph.nodes.map((n) => n.id));
    const allIds = Array.from(new Set([topicId, ...graphNodeIds, ...visibleNodeIds]));

    const registry = await this.prisma.kgNodeRegistry.findMany({
      where: { id: { in: allIds } },
    });

    const byId = new Map(registry.map((r) => [r.id, r]));

    // Filter to published nodes (topic itself always visible)
    const publishedIds = new Set<string>();
    for (const r of registry) {
      if (r.id === topicId || r.status === "PUBLISHED") publishedIds.add(r.id);
    }

    const nodes = allIds
      .filter((id) => publishedIds.has(id))
      .map((id) => {
        const r = byId.get(id);
        if (!r) {
          return { id, title: "UNKNOWN", description: null, content: null, resources: [] as string[], role: "CONCEPT" as const, isExternal: true, fipiCode: null };
        }
        const isExternal = id !== topicId && !visibleNodeIds.has(id);
        return {
          id: r.id,
          title: r.title,
          description: r.description,
          content: r.content,
          resources: r.resources,
          role: r.role as any,
          isExternal,
          fipiCode: r.fipiCode ?? null,
        };
      });

    const edges = (graph.edges as any[]).filter(
      (e) => publishedIds.has(e.from) && publishedIds.has(e.to),
    );

    const payload: TopicPagePayload = {
      topicId,
      track,
      depth,
      nodes,
      edges,
      slots: slotPayload as any,
    };
    await this.redis.set(cacheKey, payload, TOPIC_PAGE_TTL);
    return payload;
  }
}
