"use client";
import React from "react";
import CodeBlock from "@/app/components/CodeBlock";

type Props = {
  role: "user" | "assistant" | "system";
  content: string;
};

function renderContent(text: string) {
  const parts: React.ReactNode[] = [];
  const regex = /```(\w+)?\n([\s\S]*?)```/g;
  let lastIndex = 0; let m: RegExpExecArray | null;
  while ((m = regex.exec(text))) {
    const [raw, lang, code] = m;
    if (m.index > lastIndex) {
      const segment = text.slice(lastIndex, m.index);
      parts.push(<p key={`t-${lastIndex}`} className="whitespace-pre-wrap">{segment}</p>);
    }
    parts.push(<CodeBlock key={`c-${m.index}`} code={code} lang={lang} />);
    lastIndex = m.index + raw.length;
  }
  if (lastIndex < text.length) {
    parts.push(<p key={`t-${lastIndex}`} className="whitespace-pre-wrap">{text.slice(lastIndex)}</p>);
  }
  return parts;
}

export default function ChatMessage({ role, content }: Props) {
  const isUser = role === "user";
  return (
    <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`flex max-w-[95ch] md:max-w-[110ch] items-start gap-4 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
        <div
          className={`flex h-10 w-10 shrink-0 select-none items-center justify-center rounded-full text-xl shadow border ${
            isUser
              ? "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200"
              : "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/40 dark:bg-violet-950/40 dark:text-violet-200"
          }`}
          aria-hidden
        >
          {isUser ? "🧑‍💻" : "🤖"}
        </div>
        <div
          className={`rounded-2xl border px-3 py-2 text-[15px] leading-relaxed shadow-sm ${
            isUser
              ? "border-indigo-200 bg-indigo-50 text-indigo-900 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-100"
              : "border-gray-200 bg-gray-50 text-gray-900 dark:border-neutral-800 dark:bg-neutral-800 dark:text-gray-100"
          }`}
        >
          <div>
            {renderContent(content)}
          </div>
        </div>
      </div>
    </div>
  );
}
