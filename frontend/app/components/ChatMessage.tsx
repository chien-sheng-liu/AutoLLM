"use client";
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CodeBlock from "@/app/components/CodeBlock";

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
              className="ml-0.5 align-super text-[0.7em] font-semibold text-indigo-600 dark:text-indigo-300"
            >
              [{match[1]}]
            </sup>
          );
        }
        return (
          <React.Fragment key={`txt-${idx}-${segIdx}`}>{segment}</React.Fragment>
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
    return (
      <code className="rounded bg-gray-200 px-1 py-0.5 text-sm text-gray-900 dark:bg-neutral-700 dark:text-gray-100">
        {children}
      </code>
    );
  },
  p({ children }: any) {
    return (
      <p className="mb-1 whitespace-pre-line break-words leading-6 text-[14px] last:mb-0">
        {renderCitationAware(children)}
      </p>
    );
  },
  ul({ children }: any) {
    return <ul className="mb-1 list-disc space-y-0.5 pl-5 text-[14px] leading-6 last:mb-0">{renderCitationAware(children)}</ul>;
  },
  ol({ children }: any) {
    return <ol className="mb-1 list-decimal space-y-0.5 pl-5 text-[14px] leading-6 last:mb-0">{renderCitationAware(children)}</ol>;
  },
  li({ children }: any) {
    return <li className="break-words leading-6">{renderCitationAware(children)}</li>;
  },
  a({ href, children }: any) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className="text-indigo-600 underline dark:text-indigo-300">
        {children}
      </a>
    );
  },
  h1({ children }: any) {
    return <h1 className="my-2 text-[15px] font-semibold leading-6">{children}</h1>;
  },
  h2({ children }: any) {
    return <h2 className="my-2 text-[14px] font-semibold leading-6">{children}</h2>;
  },
  h3({ children }: any) {
    return <h3 className="my-1.5 text-[14px] font-medium leading-6">{children}</h3>;
  },
  table({ children }: any) {
    return <table className="mb-3 w-full table-auto border-collapse text-sm">{children}</table>;
  },
  th({ children }: any) {
    return <th className="border border-gray-300 bg-gray-100 px-2 py-1 text-left dark:border-neutral-700 dark:bg-neutral-800">{children}</th>;
  },
  td({ children }: any) {
    return <td className="border border-gray-300 px-2 py-1 dark:border-neutral-700">{children}</td>;
  },
  blockquote({ children }: any) {
    return (
      <blockquote className="border-l-4 border-indigo-200/70 bg-indigo-50/50 px-4 py-2 text-sm italic text-gray-700 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-100">
        {children}
      </blockquote>
    );
  },
  hr() {
    return <hr className="my-4 border-dashed border-gray-300 dark:border-neutral-700" />;
  },
};

const avatarMap: Record<string, { label: string; emoji: string }> = {
  user: { label: "你", emoji: "🧑‍💻" },
  assistant: { label: "Autollm", emoji: "🤖" },
  system: { label: "系統", emoji: "⚙️" },
};

export default function ChatMessage({ role, content }: Props) {
  const isUser = role === "user";
  const isSystem = role === "system";
  const avatar = avatarMap[role] || avatarMap.assistant;
  const bubbleBase = "relative inline-flex max-w-full rounded-3xl px-4 py-3 ring-1 shadow-sm transition-colors";
  const assistantBubble = `${bubbleBase} bg-white ring-gray-200/70 text-gray-900 hover:ring-gray-300 dark:bg-neutral-900 dark:ring-neutral-800 dark:text-gray-100 dark:hover:ring-neutral-700`;
  const userBubble = `${bubbleBase} bg-gradient-to-br from-indigo-600 to-indigo-500 text-white ring-indigo-500/30 hover:ring-indigo-400/50`;
  const rowWidth = "max-w-[95vw] md:max-w-[960px]";

  return (
    <article className={`relative flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`relative flex w-full items-start gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
        <div
          className={`flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full border text-base shadow ${
            isUser
              ? "border-indigo-300 bg-indigo-100 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-100"
              : "border-gray-300 bg-gray-100 text-gray-700 dark:border-neutral-700 dark:bg-neutral-800/60 dark:text-gray-200"
          }`}
          aria-hidden
        >
          {avatar.emoji}
        </div>
        <div className="flex-1">
          <div className={`group relative ${rowWidth} w-fit max-w-full ${isUser ? "ml-auto" : "mr-auto"}`}>
            {isSystem ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-[13px] text-gray-600 dark:border-neutral-700 dark:bg-neutral-900/60 dark:text-gray-300">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={markdownComponents as any}
                  className="space-y-1 text-[13px] leading-6 break-words"
                >
                  {content}
                </ReactMarkdown>
              </div>
            ) : (
              <div className={`${isUser ? userBubble : assistantBubble}`}>
                {/* Tail notch */}
                <span
                  aria-hidden
                  className={`absolute top-4 h-3 w-3 rotate-45 ${
                    isUser
                      ? "-right-1 bg-indigo-500/90"
                      : "-left-1 bg-white ring-1 ring-gray-200 dark:bg-neutral-900 dark:ring-neutral-800"
                  }`}
                />
                {/* Hover tools */}
                <div className="pointer-events-none absolute -top-3 right-1 hidden gap-1 opacity-0 transition group-hover:pointer-events-auto group-hover:flex group-hover:opacity-100">
                  <button
                    className="rounded-md border border-gray-200 bg-white px-2 py-0.5 text-[11px] text-gray-700 shadow hover:bg-gray-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-gray-200"
                    onClick={() => navigator.clipboard.writeText(content).catch(() => {})}
                    title="複製"
                  >
                    複製
                  </button>
                </div>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={markdownComponents as any}
                  className="space-y-1 text-[14px] leading-6 break-words"
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
