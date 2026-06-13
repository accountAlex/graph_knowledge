"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const STEPS = [
  {
    icon: "◎",
    title: "Это граф знаний",
    text: "Узлы — темы, понятия, методы, навыки и задачи. Стрелки показывают, что нужно понять раньше. Кликни узел, чтобы открыть детали.",
  },
  {
    icon: "◈",
    title: "Режимы и глубина",
    text: "Переключай Обзор / Фокус / Путь / Зависимости, а ползунком Depth показывай больше или меньше уровней графа.",
  },
  {
    icon: "◍",
    title: "Прогресс и пробелы",
    text: "Включи «Карту прогресса» — узлы окрасятся по уровню освоения, а пробелы загорятся красным. «Диагностика» найдёт их за пару минут.",
  },
  {
    icon: "⌘",
    title: "Быстрая навигация",
    text: "⌘K — командная палитра и поиск. Стрелки/Tab — между узлами, Enter — детали, Space — отметить изученным.",
  },
];

export function OnboardingTour({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const last = step === STEPS.length - 1;
  const s = STEPS[step];

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0"
        style={{ background: "rgba(3,7,15,0.6)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ type: "spring", stiffness: 340, damping: 28 }}
        className="relative w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", boxShadow: "0 30px 80px -20px rgba(0,0,0,0.6)" }}
      >
        <div className="p-7 text-center">
          <div
            className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-2xl mb-5"
            style={{ background: "var(--accent-subtle)", color: "var(--accent)" }}
          >
            {s.icon}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.22 }}
            >
              <h3 className="font-display text-xl mb-2" style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                {s.title}
              </h3>
              <p className="text-sm leading-relaxed max-w-sm mx-auto" style={{ color: "var(--text-secondary)" }}>
                {s.text}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Dots */}
          <div className="flex items-center justify-center gap-1.5 mt-6">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i === step ? 18 : 6,
                  height: 6,
                  background: i === step ? "var(--accent)" : "var(--border)",
                }}
              />
            ))}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between mt-7">
            <button onClick={onClose} className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
              Пропустить
            </button>
            <div className="flex items-center gap-2">
              {step > 0 && (
                <button onClick={() => setStep((v) => v - 1)} className="btn-ghost text-sm">
                  Назад
                </button>
              )}
              <button
                onClick={() => (last ? onClose() : setStep((v) => v + 1))}
                className="btn-primary text-sm"
              >
                {last ? "Понятно" : "Далее"}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
