import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ProgressService {
  constructor(private prisma: PrismaService) {}

  /** Get all completed node IDs for a user */
  async getUserProgress(userId: string): Promise<string[]> {
    const rows = await this.prisma.userProgress.findMany({
      where: { userId, completed: true },
      select: { nodeId: true },
    });
    return rows.map((r) => r.nodeId);
  }

  /** Get progress for nodes within a specific topic */
  async getTopicProgress(userId: string, nodeIds: string[]) {
    const rows = await this.prisma.userProgress.findMany({
      where: { userId, nodeId: { in: nodeIds } },
      select: { nodeId: true, completed: true, completedAt: true },
    });
    const map = new Map(rows.map((r) => [r.nodeId, r]));
    return {
      total: nodeIds.length,
      completed: rows.filter((r) => r.completed).length,
      nodes: nodeIds.map((id) => ({
        nodeId: id,
        completed: map.get(id)?.completed ?? false,
      })),
    };
  }

  /** Toggle a node's completion status */
  async toggleNode(userId: string, nodeId: string) {
    const existing = await this.prisma.userProgress.findUnique({
      where: { userId_nodeId: { userId, nodeId } },
    });

    if (existing?.completed) {
      // Unmark
      const updated = await this.prisma.userProgress.update({
        where: { id: existing.id },
        data: { completed: false, completedAt: null },
      });
      return { nodeId, completed: updated.completed };
    }

    // Mark complete
    const row = await this.prisma.userProgress.upsert({
      where: { userId_nodeId: { userId, nodeId } },
      create: { userId, nodeId, completed: true, completedAt: new Date() },
      update: { completed: true, completedAt: new Date() },
    });
    return { nodeId, completed: row.completed };
  }

  /** Summary: for each topic, how many child nodes completed vs total */
  async getSummary(userId: string) {
    // Get all topics and their children from TopicView slots
    const views = await this.prisma.topicView.findMany({
      include: { slots: { select: { orderedNodeIds: true } } },
    });

    const completedIds = new Set(await this.getUserProgress(userId));

    return views.map((v) => {
      const childIds = v.slots.flatMap((s) => s.orderedNodeIds);
      const completed = childIds.filter((id) => completedIds.has(id)).length;
      return {
        topicId: v.topicId,
        total: childIds.length,
        completed,
      };
    });
  }

  /** Bulk mark nodes as completed */
  async markNodes(userId: string, nodeIds: string[], completed: boolean) {
    const now = new Date();
    for (const nodeId of nodeIds) {
      await this.prisma.userProgress.upsert({
        where: { userId_nodeId: { userId, nodeId } },
        create: { userId, nodeId, completed, completedAt: completed ? now : null },
        update: { completed, completedAt: completed ? now : null },
      });
    }
    return { updated: nodeIds.length, completed };
  }
}
