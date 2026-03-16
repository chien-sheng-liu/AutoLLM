"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import type { Citation } from "@/lib/api";

type Props = {
  citation: Citation;
  index: number;
};

export default function CitationTooltip({ citation, index }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, above: false });
  const chipRef = useRef<HTMLSpanElement>(null);

  const TOOLTIP_W = 320;
  const TOOLTIP_H = 180;

  const calcPos = useCallback(() => {
    if (!chipRef.current) return;
    const r = chipRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = r.left;
    if (left + TOOLTIP_W > vw - 12) left = r.right - TOOLTIP_W;
    left = Math.max(12, left);

    const spaceBelow = vh - r.bottom;
    const above = spaceBelow < TOOLTIP_H + 12 && r.top > TOOLTIP_H + 12;
    const top = above ? r.top - TOOLTIP_H - 6 : r.bottom + 6;

    setPos({ top, left, above });
  }, []);

  function show() {
    if (!citation.text) return;
    calcPos();
    setOpen(true);
  }

  function hide() {
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    window.addEventListener("scroll", calcPos, true);
    window.addEventListener("resize", calcPos);
    return () => {
      window.removeEventListener("scroll", calcPos, true);
      window.removeEventListener("resize", calcPos);
    };
  }, [open, calcPos]);

  return (
    <>
      <span
        ref={chipRef}
        role={citation.text ? "button" : undefined}
        tabIndex={citation.text ? 0 : undefined}
        aria-describedby={open ? `citation-tooltip-${index}` : undefined}
        title={citation.name}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className={`inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2.5 py-1 text-[11px] text-[var(--text-secondary)] select-none transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--brand-primary)] ${citation.text ? "cursor-default hover:border-[var(--brand-200)] hover:bg-[var(--soft-brand-background)]" : "cursor-default"}`}
      >
        <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary)] text-[9px] font-bold text-white">
          {index + 1}
        </span>
        <span className="max-w-[180px] truncate">{citation.name}</span>
        {typeof citation.page === "number" && (
          <span className="shrink-0 text-[var(--text-muted)]">p.{citation.page}</span>
        )}
      </span>

      {open && citation.text && (
        <div
          id={`citation-tooltip-${index}`}
          role="tooltip"
          style={{ top: pos.top, left: pos.left, width: TOOLTIP_W }}
          className="pointer-events-none fixed z-[90] max-w-[calc(100vw-24px)] rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-3 shadow-soft-md"
        >
          {/* Amber left accent */}
          <div className="absolute left-0 top-3 bottom-3 w-[2px] rounded-full bg-[var(--brand-primary)]" />

          <div className="pl-3">
            {/* Source meta */}
            <div className="mb-1.5 flex items-center gap-2">
              <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary)] text-[9px] font-bold text-white">
                {index + 1}
              </span>
              <span className="truncate text-[11px] font-semibold text-[var(--text-primary)]">
                {citation.name}
              </span>
              {typeof citation.page === "number" && (
                <span className="ml-auto shrink-0 text-[10px] text-[var(--text-muted)]">
                  p.{citation.page}
                </span>
              )}
            </div>

            {/* Divider */}
            <div className="mb-2 h-px bg-[var(--border-light)]" />

            {/* Chunk text */}
            <p className="line-clamp-6 text-[12px] leading-relaxed text-[var(--text-secondary)]">
              {citation.text}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
