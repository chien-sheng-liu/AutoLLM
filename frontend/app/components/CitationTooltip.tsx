"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import type { Citation } from "@/lib/api";

type Props = {
  citation: Citation;
  index: number;
  /** When true renders as a compact superscript instead of a full chip */
  inline?: boolean;
};

export default function CitationTooltip({ citation, index, inline }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, above: false });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chipRef = useRef<any>(null);

  const TOOLTIP_W = 320;
  const TOOLTIP_H = 200;

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

  const hasContent = !!citation.text || typeof citation.page === "number";
  const tooltipId = `citation-tooltip-${index}-${citation.name.replace(/\s+/g, "-")}`;

  const tooltip = open && (
    <div
      id={tooltipId}
      role="tooltip"
      style={{ top: pos.top, left: pos.left, width: TOOLTIP_W }}
      className="pointer-events-none fixed z-[90] max-w-[calc(100vw-24px)] rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-3 shadow-soft-md"
    >
      {/* Amber left accent */}
      <div className="absolute bottom-3 left-0 top-3 w-[2px] rounded-full bg-[var(--brand-primary)]" />

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
        {citation.text ? (
          <p className="line-clamp-6 text-[12px] leading-relaxed text-[var(--text-secondary)]">
            {citation.text}
          </p>
        ) : (
          <p className="text-[12px] italic text-[var(--text-muted)]">
            {citation.name}
            {typeof citation.page === "number" ? `, p.${citation.page}` : ""}
          </p>
        )}
      </div>
    </div>
  );

  if (inline) {
    return (
      <>
        <sup
          ref={chipRef}
          role="button"
          tabIndex={0}
          aria-describedby={open ? tooltipId : undefined}
          title={`${citation.name}${typeof citation.page === "number" ? ` p.${citation.page}` : ""}`}
          onMouseEnter={show}
          onMouseLeave={hide}
          onFocus={show}
          onBlur={hide}
          className="mx-[1px] inline-flex h-[14px] min-w-[14px] cursor-default select-none items-center justify-center rounded-full bg-[var(--brand-primary)] px-[3px] text-[8px] font-bold text-white hover:opacity-80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--brand-primary)]"
        >
          {index + 1}
        </sup>
        {tooltip}
      </>
    );
  }

  return (
    <>
      <span
        ref={chipRef}
        role={hasContent ? "button" : undefined}
        tabIndex={hasContent ? 0 : undefined}
        aria-describedby={open ? tooltipId : undefined}
        title={citation.name}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className={`inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2.5 py-1 text-[11px] text-[var(--text-secondary)] select-none transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--brand-primary)] ${hasContent ? "cursor-default hover:border-[var(--brand-200)] hover:bg-[var(--soft-brand-background)]" : "cursor-default"}`}
      >
        <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary)] text-[9px] font-bold text-white">
          {index + 1}
        </span>
        <span className="max-w-[180px] truncate">{citation.name}</span>
        {typeof citation.page === "number" && (
          <span className="shrink-0 text-[var(--text-muted)]">
            p.{citation.page}
          </span>
        )}
      </span>
      {tooltip}
    </>
  );
}
