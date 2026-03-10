"use client";
import React from "react";

interface Props {
  content: string;
  isTyping: boolean;
}

export default function StreamingBubble({ content, isTyping }: Props) {
  return (
    <article className="group relative flex w-full justify-start">
      <div className="flex max-w-full items-start gap-0.5">
        {/* Avatar — matches ChatMessage assistant style */}
        <div
          className="flex h-6 w-6 shrink-0 select-none items-center justify-center rounded-[14px] border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[12px] font-medium text-[var(--text-secondary)] shadow-sm"
          aria-hidden
        >
          🤖
        </div>

        {/* Bubble */}
        <div className="relative w-fit max-w-[88vw] rounded-[14px] border border-[var(--border-subtle)] bg-[var(--surface-card)] px-[12px] py-[7px] text-[13px] leading-[1.35] text-[var(--text-primary)] shadow-sm sm:max-w-[700px] lg:max-w-[820px]">
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
