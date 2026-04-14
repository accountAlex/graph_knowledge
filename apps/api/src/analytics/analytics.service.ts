import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getSummary(userId: string) {
    const completed = await this.prisma.userProgress.findMany({
      where: { userId, completed: true },
      select: { nodeId: true, completedAt: true },
    });

    const total = await this.prisma.userProgress.count({ where: { userId } });

    const uniqueDays = new Set(
      completed
        .filter((r) => r.completedAt)
        .map((r) => r.completedAt!.toISOString().slice(0, 10)),
    ).size;

    return {
      completedCount: completed.length,
      totalSeen: total,
      activeDays: uniqueDays,
    };
  }

  async getActivity(userId: string) {
    const since = new Date();
    since.setDate(since.getDate() - 89);
    since.setHours(0, 0, 0, 0);

    const rows = await this.prisma.userProgress.findMany({
      where: { userId, completed: true, completedAt: { gte: since } },
      select: { completedAt: true },
    });

    const counts: Record<string, number> = {};
    for (const r of rows) {
      if (!r.completedAt) continue;
      const day = r.completedAt.toISOString().slice(0, 10);
      counts[day] = (counts[day] ?? 0) + 1;
    }

    // Build streak
    let currentStreak = 0;
    let maxStreak = 0;
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      if (counts[key]) {
        streak++;
        if (i === 0 || (i === 1 && currentStreak === 0)) currentStreak = streak;
      } else {
        if (i === 0) currentStreak = 0;
        if (streak > maxStreak) maxStreak = streak;
        streak = 0;
      }
    }
    if (streak > maxStreak) maxStreak = streak;

    return { activity: counts, currentStreak, maxStreak };
  }

  async getByRole(userId: string) {
    const rows = await this.prisma.userProgress.findMany({
      where: { userId, completed: true },
      select: { nodeId: true },
    });

    if (rows.length === 0) return [];

    const nodeIds = rows.map((r) => r.nodeId);
    const nodes = await this.prisma.kgNodeRegistry.findMany({
      where: { id: { in: nodeIds } },
      select: { id: true, role: true },
    });

    const counts: Record<string, number> = {};
    for (const n of nodes) {
      const role = n.role ?? "UNKNOWN";
      counts[role] = (counts[role] ?? 0) + 1;
    }

    return Object.entries(counts).map(([role, count]) => ({ role, count }));
  }

  async getTimeline(userId: string, limit = 20) {
    const rows = await this.prisma.userProgress.findMany({
      where: { userId, completed: true, completedAt: { not: null } },
      orderBy: { completedAt: "desc" },
      take: limit,
      select: { nodeId: true, completedAt: true },
    });

    if (rows.length === 0) return [];

    const nodeIds = rows.map((r) => r.nodeId);
    const nodes = await this.prisma.kgNodeRegistry.findMany({
      where: { id: { in: nodeIds } },
      select: { id: true, title: true, role: true },
    });

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    return rows.map((r) => ({
      nodeId: r.nodeId,
      completedAt: r.completedAt,
      title: nodeMap.get(r.nodeId)?.title ?? r.nodeId,
      role: nodeMap.get(r.nodeId)?.role ?? null,
    }));
  }
}
