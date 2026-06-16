import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ProgressService } from "../progress/progress.service";
import type { MasteryLevel } from "../generated/prisma/client";

@Injectable()
export class QuizService {
  constructor(
    private prisma: PrismaService,
    private progress: ProgressService,
  ) {}

  async listQuestions(nodeId: string) {
    return this.prisma.nodeQuestion.findMany({
      where: { nodeId },
      select: {
        id: true,
        type: true,
        question: true,
        options: true,
        // answer and explanation hidden from listing — revealed after attempt
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async submitAnswer(userId: string, questionId: string, answer: string) {
    const q = await this.prisma.nodeQuestion.findUnique({
      where: { id: questionId },
    });
    if (!q) throw new NotFoundException("Question not found");

    const correct = q.answer.trim().toLowerCase() === answer.trim().toLowerCase();

    await this.prisma.quizAttempt.create({
      data: { userId, questionId, answer, correct },
    });

    return {
      correct,
      correctAnswer: q.answer,
      explanation: q.explanation ?? null,
    };
  }

  async getNodeStats(userId: string, nodeId: string) {
    const questions = await this.prisma.nodeQuestion.findMany({
      where: { nodeId },
      select: { id: true },
    });
    const questionIds = questions.map((q) => q.id);

    if (questionIds.length === 0) {
      return { total: 0, attempted: 0, correct: 0 };
    }

    // Latest attempt per question
    const attempts = await this.prisma.quizAttempt.findMany({
      where: { userId, questionId: { in: questionIds } },
      orderBy: { createdAt: "desc" },
    });

    // Keep only the latest attempt per question
    const latestByQuestion = new Map<string, boolean>();
    for (const a of attempts) {
      if (!latestByQuestion.has(a.questionId)) {
        latestByQuestion.set(a.questionId, a.correct);
      }
    }

    const attempted = latestByQuestion.size;
    const correct = Array.from(latestByQuestion.values()).filter(Boolean).length;

    return { total: questionIds.length, attempted, correct };
  }

  // Admin: create a question for a node
  async createQuestion(nodeId: string, dto: {
    type: "MULTIPLE_CHOICE" | "TEXT_INPUT";
    question: string;
    options?: string[];
    answer: string;
    explanation?: string;
  }) {
    return this.prisma.nodeQuestion.create({
      data: {
        nodeId,
        type: dto.type,
        question: dto.question,
        options: dto.options ?? [],
        answer: dto.answer,
        explanation: dto.explanation,
      },
    });
  }

  async deleteQuestion(id: string) {
    await this.prisma.nodeQuestion.delete({ where: { id } });
    return { deleted: true };
  }

  // ──────────── Diagnostic (Block 1b) ────────────

  /**
   * Build a diagnostic for a topic: a breadth-first spread of questions across
   * the topic's child nodes (one per node first, then fill up to `limit`).
   * Answers/explanations are withheld until submission.
   */
  async getDiagnostic(topicId: string, limit = 10) {
    const view = await this.prisma.topicView.findUnique({
      where: { topicId },
      include: { slots: { select: { orderedNodeIds: true } } },
    });
    const nodeIds = view ? [...new Set(view.slots.flatMap((s) => s.orderedNodeIds))] : [];
    if (nodeIds.length === 0) return [];

    const questions = await this.prisma.nodeQuestion.findMany({
      where: { nodeId: { in: nodeIds } },
      select: { id: true, type: true, question: true, options: true, nodeId: true },
    });
    if (questions.length === 0) return [];

    type Q = (typeof questions)[number];
    const shuffle = <T>(arr: T[]): T[] => {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };

    const byNode = new Map<string, Q[]>();
    for (const q of questions) {
      const arr = byNode.get(q.nodeId) ?? [];
      arr.push(q);
      byNode.set(q.nodeId, arr);
    }

    // Round-robin one question per node (shuffled), filling up to limit
    const pools = shuffle([...byNode.values()].map((arr) => shuffle(arr)));
    const picked: Q[] = [];
    let added = true;
    while (added && picked.length < limit) {
      added = false;
      for (const pool of pools) {
        if (picked.length >= limit) break;
        const q = pool.shift();
        if (q) {
          picked.push(q);
          added = true;
        }
      }
    }
    return picked;
  }

  /**
   * Build an exam variant: a shuffled set of questions drawn primarily from
   * TASK nodes (supplemented by others if needed). Answers are withheld;
   * grading reuses submitDiagnostic.
   */
  async getExam(limit = 15) {
    const taskNodes = await this.prisma.kgNodeRegistry.findMany({
      where: { role: "TASK" },
      select: { id: true },
    });
    const taskIds = taskNodes.map((n) => n.id);

    const select = { id: true, type: true, question: true, options: true, nodeId: true } as const;
    let questions = await this.prisma.nodeQuestion.findMany({
      where: { nodeId: { in: taskIds } },
      select,
    });
    if (questions.length < limit) {
      const extra = await this.prisma.nodeQuestion.findMany({
        where: { nodeId: { notIn: taskIds } },
        select,
      });
      questions = [...questions, ...extra];
    }

    for (let i = questions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [questions[i], questions[j]] = [questions[j], questions[i]];
    }
    return questions.slice(0, limit);
  }

  /**
   * Grade a batch of diagnostic answers, record attempts, and derive a mastery
   * level per node (all correct → MASTERED, some → PRACTICED, none → SEEN).
   */
  async submitDiagnostic(
    userId: string,
    answers: { questionId: string; answer: string }[],
  ) {
    const ids = answers.map((a) => a.questionId);
    const questions = await this.prisma.nodeQuestion.findMany({
      where: { id: { in: ids } },
    });
    const qById = new Map(questions.map((q) => [q.id, q]));

    const results: {
      questionId: string;
      nodeId: string;
      correct: boolean;
      correctAnswer: string;
      explanation: string | null;
    }[] = [];
    const perNode = new Map<string, { total: number; correct: number }>();

    for (const a of answers) {
      const q = qById.get(a.questionId);
      if (!q) continue;
      const correct = q.answer.trim().toLowerCase() === a.answer.trim().toLowerCase();
      await this.prisma.quizAttempt.create({
        data: { userId, questionId: q.id, answer: a.answer, correct },
      });
      results.push({
        questionId: q.id,
        nodeId: q.nodeId,
        correct,
        correctAnswer: q.answer,
        explanation: q.explanation ?? null,
      });
      const agg = perNode.get(q.nodeId) ?? { total: 0, correct: 0 };
      agg.total += 1;
      if (correct) agg.correct += 1;
      perNode.set(q.nodeId, agg);
    }

    const byNode: { nodeId: string; total: number; correct: number; mastery: MasteryLevel }[] = [];
    for (const [nodeId, agg] of perNode) {
      const mastery: MasteryLevel =
        agg.correct === agg.total ? "MASTERED" : agg.correct > 0 ? "PRACTICED" : "SEEN";
      await this.progress.setMastery(userId, nodeId, mastery);
      byNode.push({ nodeId, total: agg.total, correct: agg.correct, mastery });
    }

    return {
      results,
      byNode,
      score: { correct: results.filter((r) => r.correct).length, total: results.length },
    };
  }
}
