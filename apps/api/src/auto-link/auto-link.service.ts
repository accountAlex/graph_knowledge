import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Neo4jService } from "../neo4j/neo4j.service";

const MISTRAL_API = "https://api.mistral.ai/v1/embeddings";
const EMBED_MODEL = "mistral-embed";
const BATCH_SIZE = 16;
const SIMILARITY_THRESHOLD = 0.82;
const MAX_SUGGESTIONS = 30;

export interface LinkSuggestion {
  fromId: string;
  fromTitle: string;
  fromRole: string;
  toId: string;
  toTitle: string;
  toRole: string;
  similarity: number;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
}

async function embedBatch(texts: string[], apiKey: string): Promise<number[][]> {
  const res = await fetch(MISTRAL_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Mistral embeddings error ${res.status}: ${err}`);
  }

  const json = await res.json();
  // Sort by index to preserve order
  return (json.data as { index: number; embedding: number[] }[])
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

@Injectable()
export class AutoLinkService {
  private readonly logger = new Logger(AutoLinkService.name);

  constructor(
    private prisma: PrismaService,
    private neo: Neo4jService,
  ) {}

  /**
   * Embeds all PUBLISHED nodes (in batches of 16), computes pairwise
   * cosine similarity, returns pairs above threshold that don't already
   * have a PREREQ_REQUIRED edge in Neo4j.
   */
  async getSuggestions(): Promise<LinkSuggestion[]> {
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) throw new Error("MISTRAL_API_KEY is not set");

    // 1. Load all published nodes
    const nodes = await this.prisma.kgNodeRegistry.findMany({
      where: { status: "PUBLISHED" },
      select: { id: true, title: true, description: true, role: true },
    });

    if (nodes.length < 2) return [];

    this.logger.log(`Embedding ${nodes.length} nodes…`);

    // 2. Embed in batches
    const texts = nodes.map((n) =>
      [n.title, n.description ?? ""].filter(Boolean).join(". "),
    );

    const allEmbeddings: number[][] = [];
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      const vecs = await embedBatch(batch, apiKey);
      allEmbeddings.push(...vecs);
      this.logger.log(`Embedded ${Math.min(i + BATCH_SIZE, texts.length)}/${texts.length}`);
    }

    // 3. Load existing Neo4j PREREQ edges to exclude
    const existingEdges = await this.neo.getAllEdges();
    const existingSet = new Set(
      existingEdges
        .filter((e) => e.type === "PREREQ_REQUIRED")
        .map((e) => `${e.from}→${e.to}`),
    );

    // 4. Pairwise cosine similarity — only upper triangle
    const suggestions: LinkSuggestion[] = [];

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const sim = cosine(allEmbeddings[i], allEmbeddings[j]);
        if (sim < SIMILARITY_THRESHOLD) continue;

        const key1 = `${nodes[i].id}→${nodes[j].id}`;
        const key2 = `${nodes[j].id}→${nodes[i].id}`;
        if (existingSet.has(key1) || existingSet.has(key2)) continue;

        suggestions.push({
          fromId: nodes[i].id,
          fromTitle: nodes[i].title,
          fromRole: nodes[i].role,
          toId: nodes[j].id,
          toTitle: nodes[j].title,
          toRole: nodes[j].role,
          similarity: Math.round(sim * 1000) / 1000,
        });
      }
    }

    // Sort by similarity desc, cap at MAX_SUGGESTIONS
    suggestions.sort((a, b) => b.similarity - a.similarity);
    return suggestions.slice(0, MAX_SUGGESTIONS);
  }

  /** Approve a suggestion — creates PREREQ_REQUIRED edge in Neo4j */
  async approve(fromId: string, toId: string): Promise<void> {
    await this.neo.createEdge(fromId, toId, "PREREQ_REQUIRED");
  }

  /** Reject a suggestion — no-op (just don't store it) */
  reject(_fromId: string, _toId: string): void {
    // Suggestions are re-computed on demand; rejection is implicit
  }
}
