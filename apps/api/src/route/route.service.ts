import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Neo4jService } from "../neo4j/neo4j.service";
import OpenAI from "openai";

export interface RouteStep {
  topicId: string;
  title: string;
  description: string;
  why: string;          // LLM-generated explanation of why this step is needed
  order: number;
}

export interface LearningRoute {
  goal: string;
  matchedTopicId: string | null;
  matchedTitle: string | null;
  steps: RouteStep[];
  summary: string;      // LLM overall summary
}

@Injectable()
export class RouteService {
  private llm: OpenAI;
  private model: string;

  constructor(
    private prisma: PrismaService,
    private neo4j: Neo4jService,
  ) {
    this.llm = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY ?? "",
      baseURL: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
    });
    this.model = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";
  }

  // ── Step 1: find the closest topic to the user's goal ────────────────────
  private async matchTopic(goal: string): Promise<{ id: string; title: string } | null> {
    // Simple fulltext search first
    const words = goal
      .toLowerCase()
      .replace(/[^а-яёa-z0-9\s]/gi, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2);

    if (words.length === 0) return null;

    // Try FTS
    try {
      const tsquery = words.map((w) => `${w}:*`).join(" & ");
      const rows = await this.prisma.$queryRawUnsafe<{ id: string; title: string }[]>(
        `SELECT id, title FROM "KgNodeRegistry"
         WHERE role = 'TOPIC'
           AND to_tsvector('russian', title || ' ' || coalesce(description, '')) @@ to_tsquery('russian', $1)
         ORDER BY ts_rank(to_tsvector('russian', title), to_tsquery('russian', $1)) DESC
         LIMIT 1`,
        tsquery,
      );
      if (rows.length > 0) return rows[0];
    } catch { /* fall through */ }

    // ILIKE fallback
    for (const word of words) {
      const row = await this.prisma.kgNodeRegistry.findFirst({
        where: { role: "TOPIC", title: { contains: word, mode: "insensitive" } },
        select: { id: true, title: true },
      });
      if (row) return row;
    }

    return null;
  }

  // ── Step 2: BFS prereq traversal from matched topic ──────────────────────
  private async getPrereqChain(topicId: string): Promise<{ id: string; title: string; description: string | null }[]> {
    const session = this.neo4j["driver"].session();
    try {
      // Walk PREREQ_REQUIRED edges upward (topic needs these before it)
      const result = await session.run(
        `MATCH path = (prereq:KGNode)-[:PREREQ_REQUIRED*0..6]->(target:KGNode {id: $topicId})
         WHERE prereq.role = 'TOPIC'
         WITH prereq, min(length(path)) AS dist
         RETURN prereq.id AS id, prereq.title AS title, dist
         ORDER BY dist DESC`,
        { topicId },
      );
      const ids = result.records.map((r) => r.get("id") as string);

      if (ids.length === 0) return [];

      // Enrich from Postgres
      const nodes = await this.prisma.kgNodeRegistry.findMany({
        where: { id: { in: ids } },
        select: { id: true, title: true, description: true },
      });

      // Keep traversal order
      return ids
        .map((id) => nodes.find((n) => n.id === id))
        .filter((n): n is NonNullable<typeof n> => !!n);
    } finally {
      await session.close();
    }
  }

  // ── Step 3: LLM enrichment ────────────────────────────────────────────────
  private async enrichWithLLM(
    goal: string,
    steps: { title: string; description: string | null }[],
  ): Promise<{ whys: string[]; summary: string }> {
    const stepList = steps
      .map((s, i) => `${i + 1}. ${s.title}${s.description ? ": " + s.description : ""}`)
      .join("\n");

    const prompt = `Ученик хочет: "${goal}"

Мы составили для него следующий маршрут обучения (от базовых к целевой теме):
${stepList}

Ответь строго в формате JSON (без markdown, без пояснений):
{
  "whys": ["объяснение для шага 1", "объяснение для шага 2", ...],
  "summary": "краткое вступление к маршруту (2-3 предложения)"
}

Каждый элемент "whys" — 1-2 предложения, почему эта тема нужна перед следующей.`;

    try {
      const res = await this.llm.chat.completions.create({
        model: this.model,
        messages: [
          { role: "system", content: "Ты — образовательный ассистент MathGraph. Отвечай только JSON." },
          { role: "user", content: prompt },
        ],
        max_tokens: 800,
        temperature: 0.4,
      });

      const text = res.choices[0]?.message?.content ?? "{}";
      const json = JSON.parse(text.replace(/```json|```/g, "").trim()) as {
        whys?: string[];
        summary?: string;
      };

      return {
        whys: json.whys ?? steps.map(() => ""),
        summary: json.summary ?? "",
      };
    } catch {
      return {
        whys: steps.map(() => ""),
        summary: "Персональный маршрут составлен на основе графа зависимостей тем.",
      };
    }
  }

  // ── Public method ─────────────────────────────────────────────────────────
  async buildRoute(goal: string): Promise<LearningRoute> {
    const matched = await this.matchTopic(goal);

    if (!matched) {
      return {
        goal,
        matchedTopicId: null,
        matchedTitle: null,
        steps: [],
        summary: "Не удалось найти подходящую тему в графе знаний. Попробуйте переформулировать цель.",
      };
    }

    const chain = await this.getPrereqChain(matched.id);

    // Always include the goal topic itself at the end
    const goalNode = await this.prisma.kgNodeRegistry.findUnique({
      where: { id: matched.id },
      select: { id: true, title: true, description: true },
    });

    const allSteps = [...chain];
    if (goalNode && !allSteps.find((s) => s.id === goalNode.id)) {
      allSteps.push(goalNode);
    }

    const { whys, summary } = await this.enrichWithLLM(goal, allSteps);

    const steps: RouteStep[] = allSteps.map((s, i) => ({
      topicId: s.id,
      title: s.title,
      description: s.description ?? "",
      why: whys[i] ?? "",
      order: i + 1,
    }));

    return {
      goal,
      matchedTopicId: matched.id,
      matchedTitle: matched.title,
      steps,
      summary,
    };
  }
}
