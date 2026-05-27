"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChatPanel } from "./ChatPanel";

type Props = {
  topicId?: string;
};

export function ChatButton({ topicId }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            key="chat-panel"
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            style={{ position: "fixed", bottom: 0, right: 0, zIndex: 50, transformOrigin: "bottom right" }}
          >
            <ChatPanel topicId={topicId} onClose={() => setOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!open && (
          <motion.button
            key="chat-btn"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.12 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: "spring", stiffness: 450, damping: 25 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-4 right-4 z-50 w-12 h-12 rounded-full flex items-center justify-center"
            style={{
              background: "var(--accent)",
              color: "#fff",
              boxShadow: "0 4px 16px var(--accent-glow), 0 2px 8px rgba(0,0,0,0.2)",
            }}
            title="AI Помощник"
          >
            <motion.span
              animate={{ rotate: [0, -10, 10, 0] }}
              transition={{ delay: 1.5, duration: 0.5, repeat: Infinity, repeatDelay: 4 }}
              className="text-lg"
            >
              ◈
            </motion.span>
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}
