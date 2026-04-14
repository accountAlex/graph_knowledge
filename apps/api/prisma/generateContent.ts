/**
 * generateContent.ts
 *
 * Fills empty `content` fields for all PUBLISHED nodes via LLM.
 * Safe to re-run: skips nodes that already have content.
 *
 * Run:  npx tsx prisma/generateContent.ts
 * Options:
 *   --role CONCEPT   (process only one role)
 *   --limit 20       (process at most N nodes)
 *   --dry-run        (print prompts, don't write to DB)
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import OpenAI from "openai";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const llm = new OpenAI({
  apiKey: process.env.MISTRAL_API_KEY ?? "",
  baseURL: "https://api.mistral.ai/v1",
});
const MODEL = "open-mistral-nemo";

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const roleFilter  = args.includes("--role")    ? args[args.indexOf("--role") + 1]    : null;
const limitArg    = args.includes("--limit")   ? parseInt(args[args.indexOf("--limit") + 1]) : Infinity;
const dryRun      = args.includes("--dry-run");

// ── Prompts per role ──────────────────────────────────────────────────────────

const ROLE_INSTRUCTIONS: Record<string, string> = {
  TOPIC: `Напиши краткий обзор математической темы для ученика 9–11 класса.
Структура:
## Что это такое
1–2 предложения — суть темы.
## Зачем нужно
1–2 предложения — практическое применение или связь с другими темами.
## Ключевые идеи
3–4 пункта списком — главное, что нужно понять.`,

  CONCEPT: `Напиши объяснение математического понятия для ученика 9–11 класса.
Структура:
## Определение
Чёткое определение в 1–2 предложениях.
## Пример
Конкретный числовой пример.
## Важно помнить
1–2 пункта — типичные ошибки или нюансы.`,

  METHOD: `Напиши описание математического метода/алгоритма для ученика 9–11 класса.
Структура:
## Суть метода
1–2 предложения.
## Алгоритм
Нумерованные шаги применения.
## Пример
Разбор одного примера по шагам.`,

  SKILL: `Напиши описание практического навыка по математике для ученика 9–11 класса.
Структура:
## Навык
Что именно умеет делать ученик, освоив это.
## Как тренировать
2–3 конкретных совета.
## Типичные ошибки
1–2 пункта.`,

  TASK: `Напиши условие и полное решение задачи по математике в стиле ЕГЭ.
Структура:
## Задание
Чёткое условие задачи (одно-два действия).
## Решение
Пошаговое решение с пояснениями.
## Ответ
Итоговый ответ.`,
};

// ── Build prompt ──────────────────────────────────────────────────────────────

function buildPrompt(node: { title: string; description: string | null; role: string }): string {
  const instruction = ROLE_INSTRUCTIONS[node.role] ?? ROLE_INSTRUCTIONS.CONCEPT;
  const descPart = node.description ? `\nКонтекст: ${node.description}` : "";
  return `${instruction}

Тема: "${node.title}"${descPart}

Пиши только markdown-контент (без вводных фраз типа "Конечно!" или "Вот...").
Только ASCII + кириллица. Без LaTeX-формул (используй обычный текст: x^2, sqrt(x) и т.д.).
Максимум 300 слов.`;
}

// ── Call LLM with retry ───────────────────────────────────────────────────────

async function callLLM(prompt: string): Promise<string> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await llm.chat.completions.create({
        model: MODEL,
        max_tokens: 600,
        temperature: 0.4,
        messages: [{ role: "user", content: prompt }],
      });
      const text = res.choices?.[0]?.message?.content?.trim() ?? "";
      if (text.length < 50) throw new Error(`Response too short: ${text.length} chars`);
      return text;
    } catch (e: any) {
      if (attempt < 3) {
        process.stdout.write(` retry${attempt}…`);
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      } else {
        throw e;
      }
    }
  }
  throw new Error("unreachable");
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const where: any = {
    status: "PUBLISHED",
    content: null,
  };
  if (roleFilter) where.role = roleFilter;

  const nodes = await prisma.kgNodeRegistry.findMany({
    where,
    select: { id: true, title: true, description: true, role: true, fipiCode: true },
    orderBy: [{ role: "asc" }, { title: "asc" }],
    take: isFinite(limitArg) ? limitArg : undefined,
  });

  console.log(`Found ${nodes.length} nodes without content${roleFilter ? ` (role=${roleFilter})` : ""}`);
  if (dryRun) console.log("[DRY RUN — no DB writes]\n");

  let ok = 0, fail = 0;

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const label = `[${i + 1}/${nodes.length}] ${n.role} "${n.title}"`;
    process.stdout.write(label + "… ");

    const prompt = buildPrompt(n);

    if (dryRun) {
      console.log("\n--- PROMPT ---\n" + prompt + "\n");
      continue;
    }

    try {
      const content = await callLLM(prompt);
      await prisma.kgNodeRegistry.update({
        where: { id: n.id },
        data: { content },
      });
      console.log("✓");
      ok++;
    } catch (e: any) {
      console.log(`⚠ failed: ${e.message}`);
      fail++;
    }

    // Small delay to avoid rate limiting
    if (i < nodes.length - 1) await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\nDone: ${ok} updated, ${fail} failed`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
