import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import OpenAI from "openai";
import type { ChatMessageDto } from "./dto/assistant.dto";

const SYSTEM_PROMPT = `Ты — AI-помощник по математике в системе MathGraph. Твоя задача — помогать ученикам разобраться в темах школьной математики (алгебра, геометрия, тригонометрия).

Правила:
- Отвечай на русском языке.
- Давай чёткие, структурированные объяснения с примерами.
- Используй формулы (в текстовой записи, например: x = (-b ± √D) / 2a).
- Если ученик не понимает — объясни проще, используя аналогии.
- Не решай домашние задания целиком — помогай разобраться в методе.
- Если вопрос не по математике — вежливо скажи, что помогаешь только с математикой.`;

@Injectable()
export class AssistantService {
  private client: OpenAI;
  private model: string;
  private readonly logger = new Logger(AssistantService.name);

  constructor(private prisma: PrismaService) {
    const apiKey = process.env.DEEPSEEK_API_KEY ?? "";
    const baseURL = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
    this.model = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";

    this.client = new OpenAI({ apiKey, baseURL });
  }

  //AI

  async ask(question: string, topicId?: string, history?: ChatMessageDto[]): Promise<string> {
    let topicContext = "";
    if (topicId) {
      topicContext = await this.buildTopicContext(topicId);
    }

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    if (topicContext) {
      messages.push({
        role: "system",
        content: `Контекст текущей темы:\n${topicContext}`,
      });
    }

    if (history?.length) {
      for (const msg of history) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    messages.push({ role: "user", content: question });

    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages,
        max_tokens: 1024,
        temperature: 0.7,
      });

      return completion.choices[0]?.message?.content ?? "Не удалось получить ответ.";
    } catch (err: any) {
      this.logger.error("DeepSeek API error", err?.message ?? err);
      return "Извините, AI-помощник временно недоступен. Попробуйте позже.";
    }
  }

  // ──────────── Chat Sessions ────────────

  async createSession(userId: string, topicId?: string) {
    return this.prisma.chatSession.create({
      data: {
        userId,
        topicId: topicId ?? null,
        title: "Новый чат",
        messages: [],
      },
    });
  }

  async listSessions(userId: string) {
    return this.prisma.chatSession.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, topicId: true, updatedAt: true },
    });
  }

  async getSession(sessionId: string, userId: string) {
    const session = await this.prisma.chatSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) throw new NotFoundException("Chat session not found");
    return session;
  }

  async deleteSession(sessionId: string, userId: string) {
    const session = await this.prisma.chatSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) throw new NotFoundException("Chat session not found");
    await this.prisma.chatSession.delete({ where: { id: sessionId } });
    return { deleted: sessionId };
  }

  async sendMessage(sessionId: string, userId: string, question: string) {
    const session = await this.getSession(sessionId, userId);
    const history = (session.messages as unknown as ChatMessageDto[]) ?? [];

    const answer = await this.ask(question, session.topicId ?? undefined, history);

    const updated = [
      ...history,
      { role: "user" as const, content: question },
      { role: "assistant" as const, content: answer },
    ];

    // Auto-generate title from first user message
    const title = history.length === 0 ? question.slice(0, 60) : session.title;

    await this.prisma.chatSession.update({
      where: { id: sessionId },
      data: { messages: updated as any, title },
    });

    return { answer, messages: updated };
  }

  // ──────────── Topic context ────────────

  private async buildTopicContext(topicId: string): Promise<string> {
    const topic = await this.prisma.kgNodeRegistry.findUnique({ where: { id: topicId } });
    if (!topic) return "";

    const parts: string[] = [`Тема: ${topic.title}`];
    if (topic.description) parts.push(`Описание: ${topic.description}`);
    if (topic.content) parts.push(`Содержание: ${topic.content}`);

    const topicView = await this.prisma.topicView.findFirst({
      where: { topicId },
      include: { slots: true },
    });

    if (topicView) {
      const childIds = topicView.slots.flatMap((s) => s.orderedNodeIds);
      if (childIds.length > 0) {
        const children = await this.prisma.kgNodeRegistry.findMany({
          where: { id: { in: childIds } },
        });
        for (const child of children) {
          parts.push(`\n[${child.role}] ${child.title}`);
          if (child.description) parts.push(`  ${child.description}`);
          if (child.content) parts.push(`  ${child.content}`);
        }
      }
    }

    return parts.join("\n");
  }
}
