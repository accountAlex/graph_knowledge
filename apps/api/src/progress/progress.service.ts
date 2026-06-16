import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Neo4jService } from "../neo4j/neo4j.service";
import { MasteryLevel, LearningEventType, Prisma } from "../generated/prisma/client";

@Injectable()
export class ProgressService {
  constructor(
    private prisma: PrismaService,
    private neo4j: Neo4jService,
  ) {}

  /** Append a learning event to the activity log (fire-and-forget friendly). */
  private async logEvent(
    userId: string,
    nodeId: string,
    type: LearningEventType,
    meta?: Record<string, unknown>,
  ) {
    await this.prisma.learningEvent.create({
      data: { userId, nodeId, type, meta: (meta ?? undefined) as Prisma.InputJsonValue },
    });
  }

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
      select: { nodeId: true, completed: true, completedAt: true, mastery: true, confidence: true },
    });
    const map = new Map(rows.map((r) => [r.nodeId, r]));
    return {
      total: nodeIds.length,
      completed: rows.filter((r) => r.completed).length,
      nodes: nodeIds.map((id) => ({
        nodeId: id,
        completed: map.get(id)?.completed ?? false,
        mastery: map.get(id)?.mastery ?? MasteryLevel.UNSEEN,
        confidence: map.get(id)?.confidence ?? null,
      })),
    };
  }

  /** Toggle a node's completion status (keeps mastery in sync). */
  async toggleNode(userId: string, nodeId: string) {
    const existing = await this.prisma.userProgress.findUnique({
      where: { userId_nodeId: { userId, nodeId } },
    });

    if (existing?.completed) {
      // Unmark — drop back to SEEN (the user has still seen it)
      const updated = await this.prisma.userProgress.update({
        where: { id: existing.id },
        data: { completed: false, completedAt: null, mastery: MasteryLevel.SEEN, lastEventAt: new Date() },
      });
      await this.logEvent(userId, nodeId, LearningEventType.UNCOMPLETE);
      return { nodeId, completed: updated.completed, mastery: updated.mastery };
    }

    const row = await this.prisma.userProgress.upsert({
      where: { userId_nodeId: { userId, nodeId } },
      create: { userId, nodeId, completed: true, completedAt: new Date(), mastery: MasteryLevel.MASTERED, lastEventAt: new Date() },
      update: { completed: true, completedAt: new Date(), mastery: MasteryLevel.MASTERED, lastEventAt: new Date() },
    });
    await this.logEvent(userId, nodeId, LearningEventType.COMPLETE);
    return { nodeId, completed: row.completed, mastery: row.mastery };
  }

  /**
   * Set a finer-grained mastery level for a node. `completed` is kept in sync:
   * a node is "completed" exactly when it reaches MASTERED.
   */
  async setMastery(userId: string, nodeId: string, mastery: MasteryLevel, confidence?: number) {
    const completed = mastery === MasteryLevel.MASTERED;
    const now = new Date();
    const row = await this.prisma.userProgress.upsert({
      where: { userId_nodeId: { userId, nodeId } },
      create: { userId, nodeId, mastery, confidence, completed, completedAt: completed ? now : null, lastEventAt: now },
      update: { mastery, confidence, completed, completedAt: completed ? now : null, lastEventAt: now },
    });
    await this.logEvent(userId, nodeId, LearningEventType.MASTERY_CHANGE, { mastery, confidence });
    return { nodeId, completed: row.completed, mastery: row.mastery, confidence: row.confidence };
  }

  /** Record that the user opened/viewed a node (promotes UNSEEN → SEEN). */
  async recordView(userId: string, nodeId: string) {
    const existing = await this.prisma.userProgress.findUnique({
      where: { userId_nodeId: { userId, nodeId } },
      select: { mastery: true },
    });
    if (!existing) {
      await this.prisma.userProgress.create({
        data: { userId, nodeId, mastery: MasteryLevel.SEEN, completed: false, lastEventAt: new Date() },
      });
    } else {
      await this.prisma.userProgress.update({
        where: { userId_nodeId: { userId, nodeId } },
        data: { lastEventAt: new Date() },
      });
    }
    await this.logEvent(userId, nodeId, LearningEventType.VIEW);
    return { nodeId, ok: true };
  }

  /**
   * Nodes that just became learnable: not yet completed, have at least one
   * prerequisite, and every prerequisite is completed. Driven by the
   * PREREQ_REQUIRED graph (edge P→X means P is required before X).
   */
  async getUnlocked(userId: string): Promise<string[]> {
    const [edges, completedIds] = await Promise.all([
      this.neo4j.getAllEdges(),
      this.getUserProgress(userId),
    ]);
    const completed = new Set(completedIds);

    const prereqs = new Map<string, Set<string>>();
    for (const e of edges) {
      if (e.type !== "PREREQ_REQUIRED") continue;
      if (!prereqs.has(e.to)) prereqs.set(e.to, new Set());
      prereqs.get(e.to)!.add(e.from);
    }

    const unlocked: string[] = [];
    for (const [nodeId, deps] of prereqs) {
      if (completed.has(nodeId)) continue;
      let allDone = true;
      for (const d of deps) {
        if (!completed.has(d)) { allDone = false; break; }
      }
      if (allDone) unlocked.push(nodeId);
    }
    return unlocked;
  }

  // ──────────── Spaced repetition (Block 2) ────────────

  /** Nodes due for review: mastered/practiced and (never reviewed or past due). */
  async getDueReviews(userId: string, limit = 20) {
    const now = new Date();
    const rows = await this.prisma.userProgress.findMany({
      where: {
        userId,
        mastery: { in: [MasteryLevel.PRACTICED, MasteryLevel.MASTERED] },
        OR: [{ dueAt: null }, { dueAt: { lte: now } }],
      },
      orderBy: { dueAt: { sort: "asc", nulls: "first" } },
      take: Math.min(Math.max(limit, 1), 100),
      select: { nodeId: true, dueAt: true, reps: true, lapses: true, mastery: true },
    });
    if (rows.length === 0) return [];

    const ids = rows.map((r) => r.nodeId);
    const meta = await this.prisma.kgNodeRegistry.findMany({
      where: { id: { in: ids } },
      select: { id: true, title: true, description: true, role: true },
    });
    const byId = new Map(meta.map((m) => [m.id, m]));

    return rows.map((r) => ({
      nodeId: r.nodeId,
      title: byId.get(r.nodeId)?.title ?? r.nodeId,
      description: byId.get(r.nodeId)?.description ?? null,
      role: byId.get(r.nodeId)?.role ?? null,
      reps: r.reps,
      lapses: r.lapses,
      mastery: r.mastery,
    }));
  }

  /** Count of nodes currently due for review. */
  async getDueCount(userId: string) {
    const now = new Date();
    const count = await this.prisma.userProgress.count({
      where: {
        userId,
        mastery: { in: [MasteryLevel.PRACTICED, MasteryLevel.MASTERED] },
        OR: [{ dueAt: null }, { dueAt: { lte: now } }],
      },
    });
    return { due: count };
  }

  /**
   * Record a review with a recall quality (0-5) and reschedule with SM-2.
   * quality < 3 is a lapse (review again soon); ≥ 3 grows the interval.
   */
  async submitReview(userId: string, nodeId: string, quality: number) {
    const q = Math.max(0, Math.min(5, Math.round(quality)));
    const row = await this.prisma.userProgress.findUnique({
      where: { userId_nodeId: { userId, nodeId } },
    });
    if (!row) return { nodeId, scheduled: false };

    let ease = row.ease;
    let interval = row.srsInterval;
    let reps = row.reps;
    let lapses = row.lapses;

    if (q < 3) {
      reps = 0;
      interval = 1;
      lapses += 1;
    } else {
      reps += 1;
      if (reps === 1) interval = 1;
      else if (reps === 2) interval = 6;
      else interval = Math.round(interval * ease);
    }
    ease = Math.max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));

    const now = new Date();
    const dueAt = new Date(now.getTime() + interval * 86_400_000);

    await this.prisma.userProgress.update({
      where: { id: row.id },
      data: { ease, srsInterval: interval, reps, lapses, dueAt, lastReviewedAt: now },
    });
    await this.logEvent(userId, nodeId, LearningEventType.REVIEW, { quality: q, interval });

    return { nodeId, scheduled: true, interval, dueAt };
  }

  /** Recent learning events for the user (newest first). */
  async getRecentEvents(userId: string, limit = 50) {
    return this.prisma.learningEvent.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 200),
    });
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
    const mastery = completed ? MasteryLevel.MASTERED : MasteryLevel.SEEN;
    for (const nodeId of nodeIds) {
      await this.prisma.userProgress.upsert({
        where: { userId_nodeId: { userId, nodeId } },
        create: { userId, nodeId, completed, completedAt: completed ? now : null, mastery, lastEventAt: now },
        update: { completed, completedAt: completed ? now : null, mastery, lastEventAt: now },
      });
    }
    if (nodeIds.length > 0) {
      await this.prisma.learningEvent.createMany({
        data: nodeIds.map((nodeId) => ({
          userId,
          nodeId,
          type: completed ? LearningEventType.COMPLETE : LearningEventType.UNCOMPLETE,
        })),
      });
    }
    return { updated: nodeIds.length, completed };
  }
}
