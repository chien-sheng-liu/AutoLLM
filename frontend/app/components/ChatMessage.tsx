"use client";
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CodeBlock from "@/app/components/CodeBlock";
import { useLanguage } from "@/app/providers/LanguageProvider";

type Props = {
  role: "user" | "assistant" | "system";
  content: string;
};

const CITATION_SEGMENT = /\[(\d+)\]/;

function renderCitationAware(children: React.ReactNode) {
  return React.Children.map(children, (child, idx) => {
    if (typeof child === "string") {
      const segments = child.split(/(\[\d+\])/g).filter(Boolean);
      return segments.map((segment, segIdx) => {
        const match = segment.match(CITATION_SEGMENT);
        if (match) {
          return (
            <sup
              key={`cite-${idx}-${segIdx}`}
              className="chat-markdown__citation"
            >
              [{match[1]}]
            </sup>
          );
        }
        return (
          <React.Fragment key={`txt-${idx}-${segIdx}`}>
            {segment}
          </React.Fragment>
        );
      });
    }
    return child;
  });
}

const markdownComponents = {
  code({ inline, className, children }: any) {
    const match = /language-(\w+)/.exec(className || "");
    const code = String(children).replace(/\n$/, "");
    if (!inline) {
      return <CodeBlock code={code} lang={match?.[1]} />;
    }
    return <code>{children}</code>;
  },
  p({ children }: any) {
    return <p>{renderCitationAware(children)}</p>;
  },
  ul({ children }: any) {
    return <ul>{children}</ul>;
  },
  ol({ children }: any) {
    return <ol>{children}</ol>;
  },
  li({ children }: any) {
    return <li>{renderCitationAware(children)}</li>;
  },
  blockquote({ children }: any) {
    return <blockquote>{renderCitationAware(children)}</blockquote>;
  },
  a({ href, children }: any) {
    return (
      <a href={href} target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  },
  h1({ children }: any) {
    return <h1>{renderCitationAware(children)}</h1>;
  },
  h2({ children }: any) {
    return <h2>{renderCitationAware(children)}</h2>;
  },
  h3({ children }: any) {
    return <h3>{renderCitationAware(children)}</h3>;
  },
  h4({ children }: any) {
    return <h4>{renderCitationAware(children)}</h4>;
  },
  table({ children }: any) {
    return <table>{children}</table>;
  },
  th({ children }: any) {
    return <th>{children}</th>;
  },
  td({ children }: any) {
    return <td>{children}</td>;
  },
  hr() {
    return <hr />;
  },
};

const avatarMap: Record<string, { label: string; emoji: string }> = {
  user: { label: "user", emoji: "🧑‍💻" },
  assistant: { label: "Autollm", emoji: "🤖" },
  system: { label: "system", emoji: "⚙️" },
};

export default function ChatMessage({ role, content }: Props) {
  const isUser = role === "user";
  const isSystem = role === "system";
  const avatar = avatarMap[role] || avatarMap.assistant;
  const { t } = useLanguage();
  const bubbleBase =
    "relative w-fit max-w-full rounded-[14px] px-3.5 py-2 text-left text-sm break-words hyphens-auto shadow-sm";
  const assistantBubble = `${bubbleBase} border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-primary)]`;
  const userBubble = `${bubbleBase} border border-transparent bg-[var(--brand-primary)] text-white shadow-brand`;

  const copyButtonBase =
    "pointer-events-auto absolute -top-4 z-10 rounded-full border px-2 py-0.5 text-[10px] font-medium opacity-0 shadow-sm transition focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-200)] group-hover:opacity-100";
  const copyButtonSide = isUser ? "right-0" : "left-0";
  const copyButtonTone = isUser
    ? "border-transparent bg-[var(--brand-primary)]/90 text-white shadow-brand/30"
    : "border-[var(--border-light)] bg-[var(--surface)] text-[var(--text-secondary)]";

  return (
    <article
      className={`group relative flex w-full ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`flex items-start gap-1.5 ${isUser ? "flex-row-reverse max-w-[64%]" : "flex-row max-w-[80%]"}`}
      >
        <div
          className={`flex h-6 w-6 shrink-0 select-none items-center justify-center rounded-[14px] border text-[12px] font-medium shadow-sm ${
            isUser
              ? "border-transparent bg-[var(--brand-primary)] text-white shadow-brand"
              : "border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-secondary)] shadow-surface"
          }`}
          aria-hidden
        >
          {avatar.emoji}
        </div>
        <div className="flex min-w-0 flex-1">
          <div
            className={`relative flex max-w-full flex-col ${isUser ? "items-end" : "items-start"}`}
          >
            {!isSystem && (
              <button
                type="button"
                aria-label={t("chat.copy")}
                onClick={() =>
                  navigator.clipboard.writeText(content).catch(() => {})
                }
                className={`${copyButtonBase} ${copyButtonSide} ${copyButtonTone}`}
              >
                {t("chat.copy")}
              </button>
            )}
            {isSystem ? (
              <div className="max-w-[700px] rounded-[14px] border border-dashed border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-1.5 text-[12px] text-[var(--text-secondary)]">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={markdownComponents as any}
                  className="chat-markdown chat-markdown--system"
                >
                  {content}
                </ReactMarkdown>
              </div>
            ) : isUser ? (
              <div className={userBubble}>
                <span className="whitespace-pre-wrap leading-relaxed">
                  {content}
                </span>
              </div>
            ) : (
              <div className={assistantBubble}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={markdownComponents as any}
                  className="chat-markdown"
                >
                  {content}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
