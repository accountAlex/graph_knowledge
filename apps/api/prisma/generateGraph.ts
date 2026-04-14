/**
 * generateGraph.ts
 *
 * Generates a full ЕГЭ/school math knowledge graph using an LLM.
 * For each FIPI topic → asks LLM to produce concepts/methods/skills/tasks + prereqs.
 * Outputs: generated_graph.json (raw LLM output + UUIDs)
 *          generated_graph_seed_patch.ts (ready to paste into seed.ts)
 *
 * Run:  npx tsx prisma/generateGraph.ts
 */

import "dotenv/config";
import { randomUUID } from "crypto";
import { writeFileSync } from "fs";
import OpenAI from "openai";

const llm = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY ?? "",
  baseURL: process.env.DEEPSEEK_BASE_URL ?? "https://openrouter.ai/api/v1",
});
const MODEL = process.env.DEEPSEEK_MODEL ?? "nvidia/nemotron-3-super-120b-a12b:free";

// ── FIPI 2026 topics (from кодификатор, Раздел 2) ────────────────────────────

interface FipiTopic {
  code: string;   // e.g. "1.1"
  title: string;
  prereqCodes: string[]; // topic-level prereqs by code
}

const FIPI_TOPICS: FipiTopic[] = [
  // ─ 1. Числа и вычисления ─
  { code: "1.1", title: "Натуральные и целые числа. Признаки делимости", prereqCodes: [] },
  { code: "1.2", title: "Рациональные числа. Дроби, проценты", prereqCodes: ["1.1"] },
  { code: "1.3", title: "Степень и корень натуральной степени", prereqCodes: ["1.1", "1.2"] },
  { code: "1.4", title: "Степень с рациональным показателем. Свойства степени", prereqCodes: ["1.3"] },
  { code: "1.5", title: "Синус, косинус, тангенс числового аргумента. Арксинус, арккосинус, арктангенс", prereqCodes: ["1.2"] },
  { code: "1.6", title: "Логарифм числа. Десятичные и натуральные логарифмы", prereqCodes: ["1.4"] },
  { code: "1.7", title: "Действительные числа. Приближённые вычисления, округление", prereqCodes: ["1.2"] },
  { code: "1.8", title: "Преобразование выражений", prereqCodes: ["1.3", "1.4", "1.6"] },

  // ─ 2. Уравнения и неравенства ─
  { code: "2.1", title: "Целые и дробно-рациональные уравнения", prereqCodes: ["1.2", "1.8"] },
  { code: "2.2", title: "Иррациональные уравнения", prereqCodes: ["1.3", "2.1"] },
  { code: "2.3", title: "Тригонометрические уравнения", prereqCodes: ["1.5", "2.1"] },
  { code: "2.4", title: "Показательные и логарифмические уравнения", prereqCodes: ["1.4", "1.6", "2.1"] },
  { code: "2.5", title: "Целые и дробно-рациональные неравенства", prereqCodes: ["2.1"] },
  { code: "2.6", title: "Иррациональные неравенства", prereqCodes: ["2.2", "2.5"] },
  { code: "2.7", title: "Показательные и логарифмические неравенства", prereqCodes: ["2.4", "2.5"] },
  { code: "2.8", title: "Тригонометрические неравенства", prereqCodes: ["2.3", "2.5"] },
  { code: "2.9", title: "Системы и совокупности уравнений и неравенств", prereqCodes: ["2.1", "2.5"] },
  { code: "2.10", title: "Уравнения, неравенства и системы с параметрами", prereqCodes: ["2.9"] },

  // ─ 3. Функции и графики ─
  { code: "3.1", title: "Функция, способы задания. Чётность, нечётность, периодичность", prereqCodes: ["1.2"] },
  { code: "3.2", title: "Область определения, нули, монотонность, экстремумы функции", prereqCodes: ["3.1"] },
  { code: "3.3", title: "Степенная функция с натуральным и целым показателем. Корень n-й степени", prereqCodes: ["1.3", "3.1"] },
  { code: "3.4", title: "Тригонометрические функции, их свойства и графики", prereqCodes: ["1.5", "3.1"] },
  { code: "3.5", title: "Показательная и логарифмическая функции, их свойства и графики", prereqCodes: ["1.4", "1.6", "3.1"] },
  { code: "3.6", title: "Преобразования графиков функций", prereqCodes: ["3.2", "3.3", "3.4", "3.5"] },
  { code: "3.7", title: "Последовательности. Арифметическая и геометрическая прогрессии", prereqCodes: ["1.2", "3.1"] },
  { code: "3.8", title: "Формула сложных процентов", prereqCodes: ["1.2", "3.7"] },

  // ─ 4. Начала математического анализа ─
  { code: "4.1", title: "Производная функции. Производные элементарных функций", prereqCodes: ["3.1", "3.2", "3.4", "3.5"] },
  { code: "4.2", title: "Применение производной: монотонность, экстремумы, наибольшее и наименьшее значение", prereqCodes: ["4.1"] },
  { code: "4.3", title: "Первообразная. Определённый интеграл. Площадь фигуры", prereqCodes: ["4.1"] },

  // ─ 5. Множества и логика ─
  { code: "5.1", title: "Множество, операции над множествами. Диаграммы Эйлера–Венна", prereqCodes: [] },
  { code: "5.2", title: "Логика. Высказывания, отрицание, конъюнкция, дизъюнкция, импликация", prereqCodes: ["5.1"] },

  // ─ 6. Вероятность и статистика ─
  { code: "6.1", title: "Описательная статистика. Среднее, медиана, дисперсия", prereqCodes: ["1.2"] },
  { code: "6.2", title: "Вероятность случайного события. Формулы сложения и умножения", prereqCodes: ["6.1"] },
  { code: "6.3", title: "Комбинаторика. Перестановки, сочетания, бином Ньютона", prereqCodes: ["1.1", "6.2"] },

  // ─ 7. Геометрия ─
  { code: "7.1", title: "Фигуры на плоскости (планиметрия). Теоремы о треугольниках, четырёхугольниках, окружности", prereqCodes: ["1.2"] },
  { code: "7.2", title: "Прямые и плоскости в пространстве. Параллельность, перпендикулярность", prereqCodes: ["7.1"] },
  { code: "7.3", title: "Многогранники. Призма, пирамида, куб. Сечения, объёмы", prereqCodes: ["7.2"] },
  { code: "7.4", title: "Тела и поверхности вращения. Цилиндр, конус, шар, сфера", prereqCodes: ["7.2"] },
  { code: "7.5", title: "Координаты и векторы. Скалярное и векторное произведение", prereqCodes: ["7.1", "1.2"] },
];

// ── LLM prompt ────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Ты — методист по математике, создающий структурированный граф знаний для подготовки к ЕГЭ.
Для заданной темы ответь строго в JSON без пояснений и markdown-блоков.`;

function buildUserPrompt(topic: FipiTopic): string {
  return `ЕГЭ тема ${topic.code}: "${topic.title}"
Ответь ТОЛЬКО JSON (без markdown, без пояснений):
{"concepts":["название1","название2"],"methods":["название1","название2"],"skills":["название1","название2"],"tasks":["Задание ЕГЭ: ...","Задание ЕГЭ: ..."],"prereqs":[["от","к"]]}
Ровно 2 элемента в каждом массиве. prereqs — 1 пара зависимостей внутри темы. Только ASCII+кириллица, никакого LaTeX.`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

// Simplified: titles only to avoid JSON parsing issues with LaTeX/special chars
interface LLMTopicData {
  concepts: string[];
  methods: string[];
  skills: string[];
  tasks: string[];
  prereqs: [string, string][]; // [from_title, to_title]
}

interface GeneratedNode {
  id: string;
  topicCode: string;
  role: "TOPIC" | "CONCEPT" | "METHOD" | "SKILL" | "TASK";
  title: string;
  description: string;
  fipiCode: string;
}

interface GeneratedEdge {
  from: string; // id
  to: string;   // id
  type: "CONTAINS" | "PREREQ_REQUIRED";
}

// ── Call LLM ──────────────────────────────────────────────────────────────────

async function callLLM(topic: FipiTopic): Promise<LLMTopicData> {
  const EMPTY: LLMTopicData = { concepts: [], methods: [], skills: [], tasks: [], prereqs: [] };

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const resp = await llm.chat.completions.create({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(topic) },
        ],
        temperature: 0.2,
        max_tokens: 800,
      });

      const raw = resp.choices[0]?.message?.content ?? "";
      const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

      // Find first complete JSON object
      const start = cleaned.indexOf("{");
      const end   = cleaned.lastIndexOf("}");
      if (start === -1 || end === -1) throw new Error("No JSON braces found");

      const parsed = JSON.parse(cleaned.slice(start, end + 1)) as LLMTopicData;
      return parsed;
    } catch (e: any) {
      if (attempt < 3) {
        process.stdout.write(` retry${attempt}… `);
        await sleep(2000);
      } else {
        console.error(`  ⚠ failed after 3 attempts: ${e.message}`);
        return EMPTY;
      }
    }
  }
  return EMPTY;
}

// ── Sleep ─────────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const allNodes: GeneratedNode[] = [];
  const allEdges: GeneratedEdge[] = [];

  // Map: topicCode → topicId
  const topicIdByCode = new Map<string, string>();

  // Step 1: create topic nodes
  for (const t of FIPI_TOPICS) {
    const id = randomUUID();
    topicIdByCode.set(t.code, id);
    allNodes.push({
      id,
      topicCode: t.code,
      role: "TOPIC",
      title: t.title,
      description: `Тема ЕГЭ ${t.code} — ${t.title}`,
      fipiCode: t.code,
    });
  }

  // Step 2: topic-level PREREQ edges
  for (const t of FIPI_TOPICS) {
    for (const prereqCode of t.prereqCodes) {
      const fromId = topicIdByCode.get(prereqCode);
      const toId = topicIdByCode.get(t.code);
      if (fromId && toId) {
        allEdges.push({ from: fromId, to: toId, type: "PREREQ_REQUIRED" });
      }
    }
  }

  // Step 3: for each topic, generate sub-nodes via LLM
  for (let i = 0; i < FIPI_TOPICS.length; i++) {
    const topic = FIPI_TOPICS[i];
    const topicId = topicIdByCode.get(topic.code)!;
    process.stdout.write(`[${i + 1}/${FIPI_TOPICS.length}] ${topic.code} "${topic.title}"… `);

    let data: LLMTopicData;
    try {
      data = await callLLM(topic);
    } catch (e: any) {
      console.error(`FAILED: ${e.message}`);
      await sleep(3000);
      continue;
    }

    // Map: title → id (within topic, for intra_prereqs resolution)
    const titleToId = new Map<string, string>();

    function addNodes(items: string[], role: "CONCEPT" | "METHOD" | "SKILL" | "TASK") {
      for (const raw of (items ?? []).slice(0, 4)) {
        const title = String(raw ?? "").trim();
        if (!title) continue;
        const id = randomUUID();
        titleToId.set(title, id);
        allNodes.push({ id, topicCode: topic.code, role, title, description: "", fipiCode: topic.code });
        allEdges.push({ from: topicId, to: id, type: "CONTAINS" });
      }
    }

    addNodes(data.concepts ?? [], "CONCEPT");
    addNodes(data.methods  ?? [], "METHOD");
    addNodes(data.skills   ?? [], "SKILL");
    addNodes(data.tasks    ?? [], "TASK");

    // Intra-topic PREREQ edges
    for (const pr of data.prereqs ?? []) {
      if (!Array.isArray(pr) || pr.length < 2) continue;
      const fromId = titleToId.get(String(pr[0]).trim());
      const toId   = titleToId.get(String(pr[1]).trim());
      if (fromId && toId) {
        allEdges.push({ from: fromId, to: toId, type: "PREREQ_REQUIRED" });
      }
    }

    console.log(`✓ ${data.concepts?.length ?? 0}c ${data.methods?.length ?? 0}m ${data.skills?.length ?? 0}s ${data.tasks?.length ?? 0}t`);

    // Rate limit: ~1 req/sec to be safe
    if (i < FIPI_TOPICS.length - 1) await sleep(1200);
  }

  // ── Output JSON ────────────────────────────────────────────────────────────

  const output = { nodes: allNodes, edges: allEdges };
  writeFileSync("prisma/generated_graph.json", JSON.stringify(output, null, 2), "utf-8");
  console.log(`\n✅ Saved prisma/generated_graph.json`);
  console.log(`   ${allNodes.length} nodes, ${allEdges.length} edges`);

  // ── Output TypeScript seed patch ───────────────────────────────────────────

  const topics    = allNodes.filter((n) => n.role === "TOPIC");
  const children  = allNodes.filter((n) => n.role !== "TOPIC");
  const contains  = allEdges.filter((e) => e.type === "CONTAINS");
  const prereqs   = allEdges.filter((e) => e.type === "PREREQ_REQUIRED");

  const lines: string[] = [
    "// AUTO-GENERATED by generateGraph.ts — paste into seed.ts",
    "// ─────────────────────────────────────────────────────────",
    "",
    "// ── GENERATED REGISTRY entries ──",
    "const GENERATED_REGISTRY: Array<{ id: string; neo4jKey: string | null; title: string; description: string; role: string; fipiCode: string }> = [",
    ...allNodes.map((n) =>
      `  { id: "${n.id}", neo4jKey: null, title: ${JSON.stringify(n.title)}, description: ${JSON.stringify(n.description)}, role: "${n.role}", fipiCode: "${n.fipiCode}" },`
    ),
    "];",
    "",
    "// ── GENERATED CONTAINS edges ──",
    "const GENERATED_CONTAINS: Array<{ from: string; to: string }> = [",
    ...contains.map((e) => `  { from: "${e.from}", to: "${e.to}" },`),
    "];",
    "",
    "// ── GENERATED PREREQ edges ──",
    "const GENERATED_PREREQS: Array<{ from: string; to: string }> = [",
    ...prereqs.map((e) => `  { from: "${e.from}", to: "${e.to}" },`),
    "];",
    "",
    "// ── Call this from main() ──",
    "async function seedGenerated() {",
    "  // Postgres: upsert nodes",
    "  for (const n of GENERATED_REGISTRY) {",
    "    await prisma.kgNodeRegistry.upsert({",
    "      where: { id: n.id },",
    "      update: { title: n.title, description: n.description, fipiCode: n.fipiCode },",
    "      create: {",
    "        id: n.id,",
    "        neo4jKey: n.neo4jKey,",
    "        title: n.title,",
    "        description: n.description,",
    "        role: n.role as any,",
    "        fipiCode: n.fipiCode,",
    "        status: 'PUBLISHED',",
    "      },",
    "    });",
    "  }",
    "  console.log(`Upserted ${GENERATED_REGISTRY.length} generated nodes`);",
    "",
    "  // Neo4j: upsert nodes + edges",
    "  const driver = neo4j.driver(",
    "    process.env.NEO4J_URI!,",
    "    neo4j.auth.basic(process.env.NEO4J_USER!, process.env.NEO4J_PASSWORD!),",
    "  );",
    "  const session = driver.session();",
    "",
    "  await session.run(",
    "    `UNWIND $nodes AS n MERGE (k:KGNode {id: n.id}) SET k.role = n.role`,",
    "    { nodes: GENERATED_REGISTRY.map(n => ({ id: n.id, role: n.role })) },",
    "  );",
    "",
    "  await session.run(",
    "    `UNWIND $rels AS r",
    "     MATCH (a:KGNode {id: r.from}), (b:KGNode {id: r.to})",
    "     MERGE (a)-[:CONTAINS]->(b)`,",
    "    { rels: GENERATED_CONTAINS },",
    "  );",
    "",
    "  await session.run(",
    "    `UNWIND $rels AS r",
    "     MATCH (a:KGNode {id: r.from}), (b:KGNode {id: r.to})",
    "     MERGE (a)-[:PREREQ_REQUIRED]->(b)`,",
    "    { rels: GENERATED_PREREQS },",
    "  );",
    "",
    "  await session.close();",
    "  await driver.close();",
    "  console.log('Neo4j: generated graph seeded');",
    "}",
  ];

  writeFileSync("prisma/generated_graph_seed_patch.ts", lines.join("\n"), "utf-8");
  console.log(`✅ Saved prisma/generated_graph_seed_patch.ts`);
  console.log(`\nStats:`);
  console.log(`  Topics:   ${topics.length}`);
  console.log(`  Children: ${children.length} (concepts/methods/skills/tasks)`);
  console.log(`  CONTAINS: ${contains.length}`);
  console.log(`  PREREQS:  ${prereqs.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
