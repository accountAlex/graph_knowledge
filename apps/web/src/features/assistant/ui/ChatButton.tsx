"use client";

import { useState } from "react";
import { ChatPanel } from "./ChatPanel";

type Props = {
  topicId?: string;
};

export function ChatButton({ topicId }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {open && <ChatPanel topicId={topicId} onClose={() => setOpen(false)} />}

      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-50 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 animate-fade-in"
          style={{
            background: "var(--accent)",
            color: "#fff",
            boxShadow: "0 4px 16px var(--accent-glow), 0 2px 8px rgba(0,0,0,0.2)",
          }}
          title="AI Помощник"
        >
          <span className="text-lg">◈</span>
        </button>
      )}
    </>
  );
}
