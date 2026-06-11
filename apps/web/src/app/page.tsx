"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { fetchTopics, type TopicListItem } from "@/lib/topicsApi";
import { useAuth } from "@/providers/AuthProvider";
import { ChatButton } from "@/features/assistant/ui/ChatButton";
import { fetchProgressSummary, type ProgressSummaryItem } from "@/lib/progressApi";
import { GlobalSearch } from "@/features/search/ui/GlobalSearch";
import { MathBackdrop } from "@/components/MathBackdrop";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

// ── Scroll reveal wrapper ───────────────────────────────────────────────────
function Reveal({
  children,
  delay = 0,
  y = 28,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.65, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

// ── Count-up number ─────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 1400, start = true) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!start) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, start]);
  return val;
}

function Stat({ value, suffix, label }: { value: number; suffix?: string; label: string }) {
  const n = useCountUp(value);
  return (
    <div>
      <div className="font-display text-3xl sm:text-4xl font-700" style={{ fontWeight: 700 }}>
        {n.toLocaleString("ru-RU")}
        {suffix && <span className="text-[#5b8cff]">{suffix}</span>}
      </div>
      <div className="mt-1 text-sm" style={{ color: "var(--s-text-dim, #93a8c6)" }}>
        {label}
      </div>
    </div>
  );
}

// ── Content data ────────────────────────────────────────────────────────────
const PROGRAMS = [
  {
    tag: "9 класс",
    title: "Подготовка к ОГЭ",
    desc: "Закрываем пробелы за 5–9 классы и доводим каждое задание ОГЭ до автоматизма.",
    accent: "#5b8cff",
  },
  {
    tag: "10–11 класс",
    title: "Подготовка к ЕГЭ",
    desc: "База и профиль. Стратегия на максимум первичных баллов и разбор второй части.",
    accent: "#38bdf8",
  },
  {
    tag: "Олимпиады",
    title: "Углублённая математика",
    desc: "Нестандартные и олимпиадные задачи для тех, кому школьной программы мало.",
    accent: "#34d399",
  },
  {
    tag: "С азов",
    title: "Математика с нуля",
    desc: "Восстанавливаем фундамент с самого начала — без стыда за прошлые оценки.",
    accent: "#fbbf24",
  },
];

const STEPS = [
  { n: "01", title: "Пробное занятие", desc: "Знакомимся и проводим диагностику уровня. Ответим на заявку в течение 30 минут." },
  { n: "02", title: "Личный маршрут", desc: "Строим путь по графу знаний — видно, какие темы держат прогресс и что учить дальше." },
  { n: "03", title: "Занятия в мини-группах", desc: "2 раза в неделю по 1,5 часа. Очно в Дмитрове (3–5 человек) или онлайн (2–3 человека)." },
  { n: "04", title: "Контроль результата", desc: "Отслеживаем рост по графу и пробникам, отправляем родителям понятные отчёты." },
];

const PRICE_FEATURES = [
  "Мини-группы: 3–5 человек офлайн, 2–3 онлайн",
  "Личный маршрут по графу знаний",
  "Доступ к AI-репетитору между занятиями",
  "Проверка домашних работ",
  "Отчёты о прогрессе для родителей",
];

// ── Topic card (knowledge-graph catalog) ────────────────────────────────────
const ROLE_COLORS = ["var(--role-topic)", "var(--role-concept)", "var(--role-method)", "var(--role-skill)", "var(--role-task)"];

function TopicCard({
  topic,
  idx,
  track,
  progressMap,
}: {
  topic: TopicListItem;
  idx: number;
  track: string;
  progressMap: Map<string, ProgressSummaryItem>;
}) {
  const p = progressMap.get(topic.id);
  const pct = p && p.total > 0 ? Math.round((p.completed / p.total) * 100) : null;

  return (
    <Reveal delay={Math.min(idx % 6, 5) * 0.05}>
      <Link
        href={`/topic/${topic.id}?track=${track}&depth=0`}
        className="group block rounded-2xl p-5 h-full transition-all duration-300"
        style={{ background: "#fff", border: "1px solid #e7edf6", boxShadow: "0 1px 2px rgba(11,28,44,0.04)" }}
      >
        <div className="flex items-center gap-1.5 mb-4">
          {ROLE_COLORS.map((color, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ background: color, opacity: 0.75 }} />
              {i < 4 && <div className="w-3.5 h-px" style={{ background: "#dce4f0" }} />}
            </div>
          ))}
        </div>

        <h3 className="text-base font-semibold leading-snug transition-colors group-hover:text-[#2f6fff]" style={{ color: "#0b1c2c" }}>
          {topic.title}
        </h3>

        {pct !== null && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px]" style={{ color: "#7c8aa0" }}>Прогресс</span>
              <span className="text-[11px] font-semibold" style={{ color: pct === 100 ? "#059669" : "#2f6fff" }}>
                {p!.completed}/{p!.total}
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "#eef2f8" }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, background: pct === 100 ? "#059669" : "#2f6fff" }}
              />
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between">
          <span className="text-[11px] font-medium px-2.5 py-1 rounded-full" style={{ background: "#eef3fd", color: "#2f6fff" }}>
            Граф темы
          </span>
          <span className="text-sm font-medium transition-transform group-hover:translate-x-1" style={{ color: "#9aa7bc" }}>
            →
          </span>
        </div>
      </Link>
    </Reveal>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function HomePage() {
  const { user } = useAuth();
  const [track] = useState("school");
  const [items, setItems] = useState<TopicListItem[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [progressMap, setProgressMap] = useState<Map<string, ProgressSummaryItem>>(new Map());

  useEffect(() => {
    const ac = new AbortController();
    fetchTopics({ track, signal: ac.signal })
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [track]);

  useEffect(() => {
    if (!user) return;
    fetchProgressSummary()
      .then((items) => setProgressMap(new Map(items.map((i) => [i.topicId, i]))))
      .catch(() => {});
  }, [user]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((t) => t.title.toLowerCase().includes(s) || t.id.includes(s));
  }, [items, q]);

  return (
    <main>
      {/* ═══════════════ HERO (night) ═══════════════ */}
      <section className="surface-night hero-night relative">
        <MathBackdrop />
        <div className="hero-grid" />
        <div className="hero-glow" style={{ top: -180, left: "50%", transform: "translateX(-50%)" }} />

        <div className="relative mx-auto max-w-6xl px-5 sm:px-6 pt-28 sm:pt-36 pb-24 sm:pb-32 text-center">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="eyebrow justify-center"
            style={{ color: "#7ea6ff" }}
          >
            Центр подготовки по математике · Дмитров и онлайн
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.08, ease: EASE }}
            className="font-display mt-6 text-4xl sm:text-6xl lg:text-7xl leading-[1.04]"
            style={{ fontWeight: 700, letterSpacing: "-0.03em", color: "#f3f7ff" }}
          >
            Математика, которая
            <br className="hidden sm:block" /> складывается в{" "}
            <span style={{ color: "#5b8cff" }}>систему</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
            className="mx-auto mt-6 max-w-2xl text-base sm:text-lg leading-relaxed"
            style={{ color: "#a9bdda" }}
          >
            Готовим к ОГЭ и ЕГЭ не по разрозненным темам, а по графу знаний:
            видим пробелы, строим личный маршрут и доводим до результата.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.32, ease: EASE }}
            className="mt-9 flex flex-wrap items-center justify-center gap-3"
          >
            <Link href="/#trial" className="btn-cta">
              Записаться на пробное
              <span aria-hidden>→</span>
            </Link>
            <Link href="/roadmap" className="btn-outline-light">
              Открыть граф знаний
            </Link>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-8 max-w-3xl mx-auto pt-10"
            style={{ borderTop: "1px solid rgba(120,160,220,0.14)" }}
          >
            <Stat value={544} label="узла в графе знаний" />
            <Stat value={39} label="тем кодификатора ЕГЭ" />
            <Stat value={550} suffix=" ₽" label="за час занятий" />
            <Stat value={30} suffix=" мин" label="среднее время ответа" />
          </motion.div>
        </div>

        {/* bottom fade into day */}
        <div className="absolute bottom-0 left-0 right-0 h-24" style={{ background: "linear-gradient(to bottom, transparent, #f5f8fd)" }} />
      </section>

      {/* ═══════════════ ПРОГРАММЫ (day) ═══════════════ */}
      <section className="surface-day section">
        <div className="mx-auto max-w-6xl px-5 sm:px-6">
          <Reveal>
            <div className="eyebrow">Программы</div>
            <h2 className="font-display mt-4 text-3xl sm:text-5xl leading-tight" style={{ fontWeight: 700, color: "#0b1c2c" }}>
              Под каждую цель — свой курс
            </h2>
            <p className="mt-4 max-w-2xl text-base sm:text-lg" style={{ color: "#5a6b82" }}>
              От «подтянуть до тройки с плюсом» до олимпиад. Начинаем с диагностики и подбираем нагрузку под ученика.
            </p>
          </Reveal>

          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {PROGRAMS.map((p, i) => (
              <Reveal key={p.title} delay={i * 0.07}>
                <div
                  className="group h-full rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1"
                  style={{ background: "#fff", border: "1px solid #e7edf6", boxShadow: "0 1px 2px rgba(11,28,44,0.04)" }}
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center mb-5"
                    style={{ background: `${p.accent}1a`, color: p.accent }}
                  >
                    <span className="font-display text-lg" style={{ fontWeight: 700 }}>∑</span>
                  </div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: p.accent }}>
                    {p.tag}
                  </span>
                  <h3 className="mt-2 text-lg font-semibold" style={{ color: "#0b1c2c" }}>
                    {p.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: "#5a6b82" }}>
                    {p.desc}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ ГРАФ ЗНАНИЙ + каталог (day, tinted) ═══════════════ */}
      <section className="section" style={{ background: "#eef2f9" }}>
        <div className="mx-auto max-w-6xl px-5 sm:px-6">
          <div className="grid lg:grid-cols-[1.1fr_1fr] gap-10 items-center">
            <Reveal>
              <div className="eyebrow">Метод</div>
              <h2 className="font-display mt-4 text-3xl sm:text-5xl leading-tight" style={{ fontWeight: 700, color: "#0b1c2c" }}>
                Учим по графу знаний,
                <br /> а не по списку тем
              </h2>
              <p className="mt-5 text-base sm:text-lg leading-relaxed" style={{ color: "#475569" }}>
                Каждая тема — это сеть понятий, методов и навыков со связями «что нужно знать раньше».
                Мы находим, где именно рвётся цепочка, и закрываем причину, а не симптом.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/roadmap" className="btn-primary">Открыть полный граф</Link>
                <Link href="/route" className="btn-ghost">AI-маршрут по пробелам</Link>
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              <div className="rounded-2xl p-2 max-w-md" style={{ background: "#fff", border: "1px solid #e2e9f4" }}>
                <GlobalSearch onQueryChange={setQ} placeholder="Найти тему, понятие или метод…" />
              </div>
            </Reveal>
          </div>

          {/* Live catalog */}
          <div className="mt-14">
            {loading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="rounded-2xl p-5" style={{ background: "#fff", border: "1px solid #e7edf6" }}>
                    <div className="skeleton h-3 w-24 mb-4" />
                    <div className="skeleton h-5 w-3/4 mb-3" />
                    <div className="skeleton h-1.5 w-full" />
                  </div>
                ))}
              </div>
            )}

            {!loading && filtered.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filtered.slice(0, 9).map((t, idx) => (
                  <TopicCard key={t.id} topic={t} idx={idx} track={track} progressMap={progressMap} />
                ))}
              </div>
            )}

            {!loading && filtered.length > 9 && (
              <div className="mt-8 text-center">
                <Link href="/presets" className="btn-ghost">Все программы и темы →</Link>
              </div>
            )}

            {!loading && filtered.length === 0 && (
              <div className="py-16 text-center" style={{ color: "#8593a8" }}>
                Ничего не найдено по запросу «{q}»
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ═══════════════ КАК ПРОХОДЯТ ЗАНЯТИЯ (night) ═══════════════ */}
      <section className="surface-night section relative overflow-hidden">
        <div className="hero-glow" style={{ bottom: -300, right: -150, opacity: 0.5 }} />
        <div className="relative mx-auto max-w-6xl px-5 sm:px-6">
          <Reveal>
            <div className="eyebrow" style={{ color: "#7ea6ff" }}>Как это работает</div>
            <h2 className="font-display mt-4 text-3xl sm:text-5xl leading-tight" style={{ fontWeight: 700, color: "#f3f7ff" }}>
              От заявки до результата —<br /> четыре шага
            </h2>
          </Reveal>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-px rounded-2xl overflow-hidden" style={{ background: "rgba(120,160,220,0.14)" }}>
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 0.08}>
                <div className="h-full p-7 sm:p-8" style={{ background: "#0a1525" }}>
                  <span className="font-display text-2xl" style={{ fontWeight: 700, color: "#5b8cff" }}>{s.n}</span>
                  <h3 className="mt-3 text-lg font-semibold" style={{ color: "#eaf1fb" }}>{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: "#9bb0cc" }}>{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ ЦЕНЫ (day) ═══════════════ */}
      <section className="surface-day section">
        <div className="mx-auto max-w-5xl px-5 sm:px-6">
          <Reveal className="text-center">
            <div className="eyebrow justify-center">Стоимость</div>
            <h2 className="font-display mt-4 text-3xl sm:text-5xl leading-tight" style={{ fontWeight: 700, color: "#0b1c2c" }}>
              Прозрачная цена без сюрпризов
            </h2>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="mt-12 grid md:grid-cols-[1fr_1.2fr] rounded-3xl overflow-hidden" style={{ border: "1px solid #e2e9f4", boxShadow: "0 24px 60px -30px rgba(11,28,44,0.25)" }}>
              {/* price */}
              <div className="p-8 sm:p-10 flex flex-col justify-center" style={{ background: "linear-gradient(160deg, #0b1c2c, #112a47)" }}>
                <span className="eyebrow" style={{ color: "#7ea6ff" }}>Абонемент на месяц</span>
                <div className="mt-4 flex items-end gap-2">
                  <span className="font-display text-5xl sm:text-6xl" style={{ fontWeight: 700, color: "#fff" }}>550</span>
                  <span className="text-xl mb-2" style={{ color: "#a9bdda" }}>₽ / час</span>
                </div>
                <p className="mt-4 text-sm leading-relaxed" style={{ color: "#9bb0cc" }}>
                  12 часов в месяц — это 8 занятий по 1,5 часа, дважды в неделю.
                  Первое, пробное занятие — бесплатно.
                </p>
                <Link href="/#trial" className="btn-cta mt-7 self-start">
                  Записаться
                  <span aria-hidden>→</span>
                </Link>
              </div>
              {/* features */}
              <div className="p-8 sm:p-10" style={{ background: "#fff" }}>
                <h3 className="text-lg font-semibold" style={{ color: "#0b1c2c" }}>Что входит</h3>
                <ul className="mt-5 space-y-3.5">
                  {PRICE_FEATURES.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm" style={{ color: "#334155" }}>
                      <span
                        className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[11px]"
                        style={{ background: "#e7f0ff", color: "#2f6fff" }}
                      >
                        ✓
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ ПРОБНОЕ ЗАНЯТИЕ (night, #trial) ═══════════════ */}
      <TrialSection />

      {/* ═══════════════ FOOTER ═══════════════ */}
      <footer className="surface-night" style={{ borderTop: "1px solid rgba(120,160,220,0.12)" }}>
        <div className="mx-auto max-w-6xl px-5 sm:px-6 py-12 grid sm:grid-cols-[2fr_1fr_1fr] gap-8">
          <div>
            <span className="font-display text-lg" style={{ fontWeight: 700, color: "#eaf1fb" }}>
              Math<span style={{ color: "#5b8cff" }}>Win</span>
            </span>
            <p className="mt-3 text-sm max-w-xs" style={{ color: "#7e93b3" }}>
              Центр подготовки по математике. Очно в Дмитрове и онлайн по всей России.
            </p>
          </div>
          <div className="text-sm">
            <div className="font-semibold mb-3" style={{ color: "#cdd9ec" }}>Разделы</div>
            <ul className="space-y-2" style={{ color: "#8aa0c0" }}>
              <li><Link href="/presets" className="hover:text-[#5b8cff]">Программы</Link></li>
              <li><Link href="/roadmap" className="hover:text-[#5b8cff]">Граф знаний</Link></li>
              <li><Link href="/route" className="hover:text-[#5b8cff]">AI-репетитор</Link></li>
            </ul>
          </div>
          <div className="text-sm">
            <div className="font-semibold mb-3" style={{ color: "#cdd9ec" }}>Контакты</div>
            <ul className="space-y-2" style={{ color: "#8aa0c0" }}>
              <li><a href="https://mathwin.ru/" className="hover:text-[#5b8cff]">mathwin.ru</a></li>
              <li><a href="https://wa.me/" className="hover:text-[#5b8cff]">WhatsApp</a></li>
              <li><a href="https://t.me/" className="hover:text-[#5b8cff]">Telegram</a></li>
            </ul>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-5 sm:px-6 py-6 text-xs flex flex-col sm:flex-row justify-between gap-2" style={{ borderTop: "1px solid rgba(120,160,220,0.1)", color: "#5e7491" }}>
          <span>© {new Date().getFullYear()} MathWin. Центр подготовки по математике.</span>
          <span>Дмитров · онлайн по РФ</span>
        </div>
      </footer>

      <ChatButton />
    </main>
  );
}

// ── Trial / lead form ───────────────────────────────────────────────────────
function TrialSection() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: подключить реальную отправку заявки (бэкенд/Telegram-бот/CRM)
    setSent(true);
  };

  return (
    <section id="trial" className="surface-night section relative overflow-hidden scroll-mt-20">
      <div className="hero-grid" />
      <div className="hero-glow" style={{ top: -200, left: "30%", opacity: 0.6 }} />
      <div className="relative mx-auto max-w-5xl px-5 sm:px-6">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <Reveal>
            <div className="eyebrow" style={{ color: "#7ea6ff" }}>Бесплатно</div>
            <h2 className="font-display mt-4 text-3xl sm:text-5xl leading-tight" style={{ fontWeight: 700, color: "#f3f7ff" }}>
              Запишитесь на пробное занятие
            </h2>
            <p className="mt-5 text-base sm:text-lg leading-relaxed" style={{ color: "#a9bdda" }}>
              Проведём диагностику, покажем граф знаний ученика и честно скажем,
              что нужно подтянуть. Ответим в течение 30 минут.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="https://wa.me/" className="btn-outline-light">WhatsApp</a>
              <a href="https://t.me/" className="btn-outline-light">Telegram</a>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="rounded-2xl p-7 sm:p-8" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(120,160,220,0.18)", backdropFilter: "blur(8px)" }}>
              {sent ? (
                <div className="text-center py-8">
                  <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center text-2xl" style={{ background: "rgba(52,211,153,0.16)", color: "#34d399" }}>
                    ✓
                  </div>
                  <h3 className="mt-4 text-lg font-semibold" style={{ color: "#eaf1fb" }}>Заявка принята</h3>
                  <p className="mt-2 text-sm" style={{ color: "#9bb0cc" }}>
                    Спасибо, {name || "друг"}! Свяжемся с вами в ближайшие 30 минут.
                  </p>
                </div>
              ) : (
                <form onSubmit={submit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: "#9bb0cc" }}>Как вас зовут</label>
                    <input
                      className="input-field"
                      style={{ background: "rgba(8,16,27,0.5)", borderColor: "rgba(120,160,220,0.22)", color: "#eaf1fb" }}
                      placeholder="Имя"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: "#9bb0cc" }}>Телефон или мессенджер</label>
                    <input
                      className="input-field"
                      style={{ background: "rgba(8,16,27,0.5)", borderColor: "rgba(120,160,220,0.22)", color: "#eaf1fb" }}
                      placeholder="+7 999 000-00-00"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                    />
                  </div>
                  <button type="submit" className="btn-cta w-full justify-center">
                    Записаться на пробное
                  </button>
                  <p className="text-center text-xs" style={{ color: "#6b7f9d" }}>
                    Нажимая кнопку, вы соглашаетесь на обработку данных
                  </p>
                </form>
              )}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
