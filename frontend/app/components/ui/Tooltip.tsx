"use client";
import React, { useId, useState } from "react";

type Props = {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
};

export default function Tooltip({ content, children, side = "top", className }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const pos =
    side === "top"
      ? "bottom-full left-1/2 -translate-x-1/2 mb-2"
      : side === "bottom"
      ? "top-full left-1/2 -translate-x-1/2 mt-2"
      : side === "left"
      ? "right-full top-1/2 -translate-y-1/2 mr-2"
      : "left-full top-1/2 -translate-y-1/2 ml-2";
  return (
    <span className={`relative inline-flex ${className || ""}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span
        aria-describedby={open ? id : undefined}
        tabIndex={0}
        className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-200)]"
      >
        {children}
      </span>
      <span
        role="tooltip"
        id={id}
        className={`pointer-events-none absolute z-50 whitespace-pre-wrap rounded-xl border px-2.5 py-1.5 text-xs shadow-surface transition-all duration-150 ${
          open ? "opacity-100" : "opacity-0"
        } ${pos} border-[var(--border-light)] bg-[var(--surface)] text-[var(--text-secondary)]`}
      >
        {content}
      </span>
    </span>
  );
}
