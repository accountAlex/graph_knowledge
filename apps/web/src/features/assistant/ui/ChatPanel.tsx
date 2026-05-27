"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { useAuth } from "@/providers/AuthProvider";
import {
  askAssistant,
  createSession,
  sendSessionMessage,
  listSessions,
  getSession,
  deleteSession,
  type ChatMessage,
  type ChatSessionSummary,
} from "@/lib/assistantApi";

type Props = {
  topicId?: string;
  onClose: () => void;
};

/**
 * Preprocess AI output to normalize LaTeX delimiters for remark-math:
 * - \[...\] → $$...$$  (display math)
 * - \(...\) → $...$   (inline math)
 * - Standalone [ LaTeX... ] on own line → $$...$$
 */
function preprocessMath(text: string): string {
  let s = text;
  // \[...\] → $$...$$ (display math, possibly multiline)
  s = s.replace(/\\\[([\s\S]*?)\\\]/g, (_m, inner) => `\n$$\n${inner.trim()}\n$$\n`);
  // \(...\) → $...$ (inline math)
  s = s.replace(/\\\(([\s\S]*?)\\\)/g, (_m, inner) => `$${inner.trim()}$`);
  // Standalone [ LaTeX ] on its own line — detect by LaTeX commands inside
  s = s.replace(
    /^\[\s*((?:[^[\]]*(?:\\[a-zA-Z]+|[_^{}])[^[\]]*)+)\s*\]\.?$/gm,
    (_m, inner) => `$$${inner.trim()}$$`,
  );
  return s;
}

function MessageContent({ content }: { content: string }) {
  const processed = preprocessMath(content);
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath, remarkGfm]}
      rehypePlugins={[rehypeKatex]}
      components={{
        p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
        h2: ({ children }) => (
          <h2 className="font-bold mt-3 mb-1.5 text-[14px]">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="font-semibold mt-2 mb-1 text-[13px]">{children}</h3>
        ),
        h4: ({ children }) => (
          <h4 className="font-semibold mt-1.5 mb-0.5">{children}</h4>
        ),
        ul: ({ children }) => <ul className="list-disc pl-4 mb-1.5">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-4 mb-1.5">{children}</ol>,
        li: ({ children }) => <li className="mb-0.5">{children}</li>,
        strong: ({ children }) => (
          <strong style={{ color: "var(--accent)" }}>{children}</strong>
        ),
        hr: () => (
          <hr className="my-2 border-0" style={{ borderTop: "1px solid var(--border)" }} />
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto my-2 rounded-lg" style={{ border: "1px solid var(--border)" }}>
            <table className="w-full text-[11px] border-collapse">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead style={{ background: "var(--bg-input)" }}>{children}</thead>
        ),
        th: ({ children }) => (
          <th className="px-2 py-1.5 text-left font-semibold" style={{ borderBottom: "1px solid var(--border)", color: "var(--text-secondary)" }}>
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="px-2 py-1.5" style={{ borderBottom: "1px solid var(--border)" }}>
            {children}
          </td>
        ),
        blockquote: ({ children }) => (
          <blockquote
            className="pl-3 my-1.5 text-[11px] italic"
            style={{ borderLeft: "3px solid var(--accent)", color: "var(--text-secondary)" }}
          >
            {children}
          </blockquote>
        ),
        code: ({ children, className }) => {
          const isBlock = className?.includes("language-");
          if (isBlock) {
            return (
              <pre
                className="rounded-lg p-2 my-1.5 overflow-x-auto text-[11px]"
                style={{ background: "var(--bg-input)" }}
              >
                <code>{children}</code>
              </pre>
            );
          }
          return (
            <code
              className="px-1 py-0.5 rounded text-[11px]"
              style={{ background: "var(--bg-input)" }}
            >
              {children}
            </code>
          );
        },
      }}
    >
      {processed}
    </ReactMarkdown>
  );
}

type View = "chat" | "history";

export function ChatPanel({ topicId, onClose }: Props) {
  const { user } = useAuth();
  const isAuth = !!user;

  const [view, setView] = useState<View>("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (view === "chat") inputRef.current?.focus();
  }, [view]);

  // Load sessions list
  const loadSessions = useCallback(async () => {
    if (!isAuth) return;
    try {
      const list = await listSessions();
      setSessions(list);
    } catch { /* ignore */ }
  }, [isAuth]);

  useEffect(() => {
    if (view === "history") loadSessions();
  }, [view, loadSessions]);

  const openSession = async (id: string) => {
    try {
      const s = await getSession(id);
      setSessionId(s.id);
      setMessages((s.messages as ChatMessage[]) ?? []);
      setView("chat");
    } catch { /* ignore */ }
  };

  const handleDeleteSession = async (id: string) => {
    await deleteSession(id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (sessionId === id) {
      setSessionId(null);
      setMessages([]);
    }
  };

  const startNewChat = () => {
    setSessionId(null);
    setMessages([]);
    setView("chat");
  };

  const send = useCallback(async () => {
    const q = input.trim();
    if (!q || loading) return;

    const userMsg: ChatMessage = { role: "user", content: q };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      if (isAuth) {
        // Session-based mode
        let sid = sessionId;
        if (!sid) {
          const s = await createSession(topicId);
          sid = s.id;
          setSessionId(sid);
        }
        const res = await sendSessionMessage(sid, q);
        setMessages(res.messages);
      } else {
        // Anonymous mode
        const answer = await askAssistant(q, topicId, messages);
        setMessages((prev) => [...prev, { role: "assistant", content: answer }]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Произошла ошибка. Попробуйте ещё раз." },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, topicId, messages, isAuth, sessionId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div
      className="fixed bottom-0 right-0 sm:bottom-4 sm:right-4 z-50 flex flex-col"
      style={{
        width: "100vw",
        height: "100dvh",
        maxWidth: "420px",
        maxHeight: "560px",
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        borderRadius: "0",
        boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        overflow: "hidden",
      }}
      data-chat-panel
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: "var(--accent)", boxShadow: "0 0 6px var(--accent-glow)" }}
          />
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            AI Помощник
          </span>
        </div>
        <div className="flex items-center gap-1">
          {isAuth && (
            <>
              <button
                onClick={startNewChat}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--bg-card)]"
                style={{ color: "var(--text-muted)" }}
                title="Новый чат"
              >
                +
              </button>
              <button
                onClick={() => setView(view === "history" ? "chat" : "history")}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--bg-card)]"
                style={{ color: view === "history" ? "var(--accent)" : "var(--text-muted)" }}
                title="История"
              >
                ☰
              </button>
            </>
          )}
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--bg-card)]"
            style={{ color: "var(--text-muted)" }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* View content */}
      <AnimatePresence mode="wait" initial={false}>
        {view === "history" ? (
          <motion.div
            key="history"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.18 }}
            className="flex-1 overflow-y-auto p-3 flex flex-col gap-1.5"
          >
            {sessions.length === 0 && (
              <div className="flex-1 flex items-center justify-center" style={{ color: "var(--text-muted)" }}>
                <div className="text-xs text-center">Нет сохранённых чатов</div>
              </div>
            )}
            {sessions.map((s, i) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors hover:bg-[var(--bg-card)]"
                style={{ border: "1px solid var(--border)" }}
                onClick={() => openSession(s.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>
                    {s.title}
                  </div>
                  <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                    {new Date(s.updatedAt).toLocaleDateString("ru-RU")}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.id); }}
                  className="w-6 h-6 rounded flex items-center justify-center text-[10px] transition-colors hover:bg-[var(--bg-input)]"
                  style={{ color: "var(--text-muted)" }}
                >
                  ✕
                </button>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="chat"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.18 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
              {messages.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 }}
                  className="flex-1 flex items-center justify-center"
                >
                  <div className="text-center" style={{ color: "var(--text-muted)" }}>
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      className="text-2xl mb-2"
                    >
                      ∑
                    </motion.div>
                    <div className="text-xs">
                      Задайте вопрос по математике
                      {topicId && " или по текущей теме"}
                    </div>
                    {!isAuth && (
                      <div className="text-[10px] mt-2" style={{ color: "var(--text-muted)" }}>
                        Войдите, чтобы сохранять историю чатов
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  className={`max-w-[90%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
                    msg.role === "user" ? "self-end" : "self-start"
                  }`}
                  style={{
                    background: msg.role === "user" ? "var(--accent)" : "var(--bg-card)",
                    color: msg.role === "user" ? "#fff" : "var(--text-primary)",
                    border: msg.role === "assistant" ? "1px solid var(--border)" : undefined,
                  }}
                >
                  {msg.role === "assistant" ? (
                    <MessageContent content={msg.content} />
                  ) : (
                    <div style={{ whiteSpace: "pre-wrap" }}>{msg.content}</div>
                  )}
                </motion.div>
              ))}

              <AnimatePresence>
                {loading && (
                  <motion.div
                    key="typing"
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="self-start px-3 py-2 rounded-xl text-xs"
                    style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
                  >
                    <div className="flex items-center gap-1.5">
                      {[0, 150, 300].map((delay) => (
                        <motion.span
                          key={delay}
                          animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
                          transition={{ duration: 0.8, repeat: Infinity, delay: delay / 1000 }}
                          className="inline-block w-1.5 h-1.5 rounded-full"
                          style={{ background: "var(--accent)" }}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Input */}
            <div className="p-3" style={{ borderTop: "1px solid var(--border)" }}>
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Спросите что-нибудь..."
                  rows={1}
                  className="input-field flex-1 resize-none text-xs"
                  style={{
                    maxHeight: "80px",
                    minHeight: "36px",
                    paddingTop: "8px",
                    paddingBottom: "8px",
                  }}
                />
                <motion.button
                  onClick={send}
                  disabled={!input.trim() || loading}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  className="btn-primary !rounded-lg !px-3 !py-2 text-xs disabled:opacity-40"
                >
                  ↑
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
