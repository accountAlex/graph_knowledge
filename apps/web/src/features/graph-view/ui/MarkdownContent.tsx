"use client";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

type Props = {
  children: string;
  className?: string;
};

export function MarkdownContent({ children, className }: Props) {
  return (
    <div className={`markdown-body ${className ?? ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeKatex]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-base font-bold mt-3 mb-1.5" style={{ color: "var(--text-primary)" }}>{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-sm font-bold mt-2.5 mb-1" style={{ color: "var(--text-primary)" }}>{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xs font-bold mt-2 mb-0.5" style={{ color: "var(--text-secondary)" }}>{children}</h3>
          ),
          p: ({ children }) => (
            <p className="text-xs leading-relaxed mb-2" style={{ color: "var(--text-secondary)" }}>{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="text-xs space-y-0.5 mb-2 pl-4 list-disc" style={{ color: "var(--text-secondary)" }}>{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="text-xs space-y-0.5 mb-2 pl-4 list-decimal" style={{ color: "var(--text-secondary)" }}>{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          code: ({ className, children }) => {
            const isBlock = className?.includes("language-");
            return isBlock ? (
              <code
                className="block p-3 rounded-lg text-[11px] font-mono leading-relaxed overflow-x-auto mb-2"
                style={{ background: "var(--bg-input)", color: "var(--text-primary)" }}
              >
                {children}
              </code>
            ) : (
              <code
                className="px-1 py-0.5 rounded text-[11px] font-mono"
                style={{ background: "var(--bg-input)", color: "var(--accent)" }}
              >
                {children}
              </code>
            );
          },
          pre: ({ children }) => <>{children}</>,
          blockquote: ({ children }) => (
            <blockquote
              className="pl-3 py-0.5 my-2 text-xs italic"
              style={{ borderLeft: "3px solid var(--accent)", color: "var(--text-muted)" }}
            >
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 transition-colors hover:text-[var(--accent-hover)]"
              style={{ color: "var(--accent)" }}
            >
              {children}
            </a>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold" style={{ color: "var(--text-primary)" }}>{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic" style={{ color: "var(--text-secondary)" }}>{children}</em>
          ),
          hr: () => <hr className="my-3" style={{ borderColor: "var(--border)" }} />,
          table: ({ children }) => (
            <div className="overflow-x-auto mb-2">
              <table className="text-xs w-full border-collapse">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th
              className="px-2 py-1 text-left font-semibold text-[11px]"
              style={{ borderBottom: "1px solid var(--border)", color: "var(--text-secondary)" }}
            >
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td
              className="px-2 py-1 text-[11px]"
              style={{ borderBottom: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}
            >
              {children}
            </td>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
