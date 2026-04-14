import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class QuizService {
  constructor(private prisma: PrismaService) {}

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
}
