"use client";
import React from "react";

interface Props {
  content: string;
  isTyping: boolean;
}

export default function StreamingBubble({ content, isTyping }: Props) {
  return (
    <article className="group relative flex w-full justify-start">
      <div className="flex max-w-[74%] items-start gap-0.5">
        {/* Avatar — matches ChatMessage assistant style */}
        <div
          className="flex h-6 w-6 shrink-0 select-none items-center justify-center rounded-[14px] border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[12px] font-medium text-[var(--text-secondary)] shadow-sm"
          aria-hidden
        >
          🤖
        </div>

        {/* Bubble */}
        <div className="relative w-fit max-w-full rounded-[14px] border border-[var(--border-subtle)] bg-[var(--surface-card)] px-[12px] py-[7px] text-[0.875rem] leading-[1.55] text-[var(--text-primary)] shadow-sm">
          {isTyping ? (
            /* Phase 1 — waiting for first token */
            <div className="typing-dots text-[var(--text-muted)]">
              <span />
              <span />
              <span />
            </div>
          ) : (
            /* Phase 2 — streaming text with blinking cursor */
            <span className="streaming-text break-words whitespace-pre-wrap hyphens-auto">
              {content}
              <span className="streaming-cursor" aria-hidden>
                ▌
              </span>
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
