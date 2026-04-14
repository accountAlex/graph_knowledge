import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Neo4jService } from "../neo4j/neo4j.service";
import { RedisService } from "../redis/redis.service";
import {
  CreateNodeDto,
  UpdateNodeDto,
  CreateEdgeDto,
  ImportGraphDto,
} from "./dto/knowledge.dto";
import { randomUUID } from "crypto";

@Injectable()
export class KnowledgeService {
  constructor(
    private prisma: PrismaService,
    private neo: Neo4jService,
    private redis: RedisService,
  ) {}

  private async invalidateGraphCache() {
    await Promise.all([
      this.redis.delByPattern("roadmap:*"),
      this.redis.delByPattern("topic-page:*"),
    ]);
  }

  // ──────────── Nodes ────────────

  async createNode(dto: CreateNodeDto) {
    const id = randomUUID();

    // 1. PostgreSQL registry
    const node = await this.prisma.kgNodeRegistry.create({
      data: {
        id,
        title: dto.title,
        description: dto.description,
        content: dto.content,
        resources: dto.resources ?? [],
        fipiCode: dto.fipiCode,
        role: dto.role,
        status: "DRAFT",
        neo4jKey: id,
      },
    });

    // 2. Neo4j node
    await this.neo.createNode(id, dto.role);

    // 3. Optional CONTAINS edge to parent topic
    if (dto.parentTopicId) {
      await this.neo.createEdge(dto.parentTopicId, id, "CONTAINS");
    }

    await this.invalidateGraphCache();
    return node;
  }

  async updateNode(id: string, dto: UpdateNodeDto, editedBy?: string) {
    const existing = await this.prisma.kgNodeRegistry.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException("Node not found");

    // Snapshot the current state as a new version before applying changes
    const lastVersion = await this.prisma.kgNodeVersion.findFirst({
      where: { nodeId: id },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const nextVersion = (lastVersion?.version ?? 0) + 1;

    await this.prisma.kgNodeVersion.create({
      data: {
        nodeId: id,
        version: nextVersion,
        title: existing.title,
        description: existing.description,
        content: existing.content,
        resources: existing.resources,
        role: existing.role,
        status: existing.status,
        editedBy: editedBy ?? null,
        changeNote: (dto as any).changeNote ?? null,
      },
    });

    const updated = await this.prisma.kgNodeRegistry.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.role !== undefined && { role: dto.role }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.content !== undefined && { content: dto.content }),
        ...(dto.resources !== undefined && { resources: dto.resources }),
        ...(dto.fipiCode !== undefined && { fipiCode: dto.fipiCode }),
        version: { increment: 1 },
      },
    });

    if (dto.role !== undefined) {
      await this.neo.updateNodeRole(id, dto.role);
    }

    await this.invalidateGraphCache();
    return updated;
  }

  async deleteNode(id: string) {
    const existing = await this.prisma.kgNodeRegistry.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException("Node not found");

    // Neo4j first (DETACH DELETE removes all edges too)
    await this.neo.deleteNode(id);

    // PostgreSQL
    await this.prisma.kgNodeRegistry.delete({ where: { id } });

    await this.invalidateGraphCache();
    return { deleted: id };
  }

  async updateStatus(id: string, status: "DRAFT" | "PUBLISHED") {
    const existing = await this.prisma.kgNodeRegistry.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Node not found");

    const updated = await this.prisma.kgNodeRegistry.update({
      where: { id },
      data: { status },
    });

    await this.invalidateGraphCache();
    return updated;
  }

  async getNode(id: string) {
    const node = await this.prisma.kgNodeRegistry.findUnique({
      where: { id },
    });
    if (!node) throw new NotFoundException("Node not found");
    return node;
  }

  async listNodes(role?: string) {
    return this.prisma.kgNodeRegistry.findMany({
      where: role ? { role: role as any } : undefined,
      orderBy: { createdAt: "desc" },
    });
  }

  // ──────────── Edges ────────────

  async createEdge(dto: CreateEdgeDto) {
    if (dto.from === dto.to) {
      throw new BadRequestException("Self-referencing edges are not allowed");
    }

    // Verify both nodes exist
    const [fromNode, toNode] = await Promise.all([
      this.prisma.kgNodeRegistry.findUnique({ where: { id: dto.from } }),
      this.prisma.kgNodeRegistry.findUnique({ where: { id: dto.to } }),
    ]);
    if (!fromNode) throw new NotFoundException(`Node ${dto.from} not found`);
    if (!toNode) throw new NotFoundException(`Node ${dto.to} not found`);

    // Create edge in Neo4j
    await this.neo.createEdge(dto.from, dto.to, dto.type);

    // Check for cycles in PREREQ_REQUIRED graph
    if (dto.type === "PREREQ_REQUIRED") {
      const cycleNode = await this.neo.detectCycle();
      if (cycleNode) {
        // Rollback: remove the edge we just created
        await this.neo.deleteEdge(dto.from, dto.to, dto.type);
        throw new BadRequestException(
          "Adding this edge would create a cycle in the prerequisite graph",
        );
      }
    }

    await this.invalidateGraphCache();
    return { from: dto.from, to: dto.to, type: dto.type };
  }

  async deleteEdge(from: string, to: string, type: string) {
    await this.neo.deleteEdge(from, to, type);
    await this.invalidateGraphCache();
    return { deleted: { from, to, type } };
  }

  // ──────────── Export ────────────

  async exportGraph() {
    const nodes = await this.prisma.kgNodeRegistry.findMany({
      orderBy: { createdAt: "asc" },
    });

    const edges = await this.neo.getAllEdges();

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      nodes: nodes.map((n) => ({
        id: n.id,
        title: n.title,
        role: n.role,
        description: n.description ?? undefined,
        content: n.content ?? undefined,
        resources: n.resources,
        fipiCode: n.fipiCode ?? undefined,
        status: n.status,
      })),
      edges,
    };
  }

  // ──────────── Batch Import ────────────

  async importGraph(dto: ImportGraphDto) {
    const result = {
      nodesCreated: 0,
      nodesUpdated: 0,
      nodesSkipped: 0,
      edgesCreated: 0,
      edgesSkipped: 0,
      errors: [] as string[],
    };

    // Build a map: provided id (or title+role key) → final id in DB
    const idMap = new Map<string, string>();

    for (const n of dto.nodes) {
      try {
        const finalId = n.id ?? randomUUID();

        const existing = n.id
          ? await this.prisma.kgNodeRegistry.findUnique({ where: { id: n.id } })
          : null;

        if (existing) {
          if (dto.overwrite) {
            await this.prisma.kgNodeRegistry.update({
              where: { id: existing.id },
              data: {
                title: n.title,
                role: n.role,
                description: n.description ?? null,
                content: n.content ?? null,
                resources: n.resources ?? [],
                fipiCode: n.fipiCode ?? null,
              },
            });
            await this.neo.updateNodeRole(existing.id, n.role);
            idMap.set(n.id!, existing.id);
            result.nodesUpdated++;
          } else {
            idMap.set(n.id!, existing.id);
            result.nodesSkipped++;
          }
        } else {
          await this.prisma.kgNodeRegistry.create({
            data: {
              id: finalId,
              title: n.title,
              role: n.role,
              description: n.description ?? null,
              content: n.content ?? null,
              resources: n.resources ?? [],
              fipiCode: n.fipiCode ?? null,
              status: n.status ?? "DRAFT",
              neo4jKey: finalId,
            },
          });
          await this.neo.createNode(finalId, n.role);
          if (n.id) idMap.set(n.id, finalId);
          result.nodesCreated++;
        }
      } catch (e: unknown) {
        result.errors.push(`Node "${n.title}": ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    for (const e of dto.edges) {
      try {
        const fromId = idMap.get(e.from) ?? e.from;
        const toId   = idMap.get(e.to) ?? e.to;

        const [fromExists, toExists] = await Promise.all([
          this.prisma.kgNodeRegistry.findUnique({ where: { id: fromId } }),
          this.prisma.kgNodeRegistry.findUnique({ where: { id: toId } }),
        ]);

        if (!fromExists || !toExists) {
          result.edgesSkipped++;
          continue;
        }

        await this.neo.createEdge(fromId, toId, e.type);
        result.edgesCreated++;
      } catch {
        result.edgesSkipped++;
      }
    }

    await this.invalidateGraphCache();
    return result;
  }
}
