"use client";
import React from "react";
import Tooltip from "@/app/components/ui/Tooltip";

export type SegmentedOption = {
  id: string;
  label: React.ReactNode;
  tooltip?: string;
};

type Props = {
  name?: string;
  options: SegmentedOption[];
  value: string;
  onChange: (val: string) => void;
  className?: string;
};

export default function Segmented({ name, options, value, onChange, className }: Props) {
  return (
    <div
      className={
        "inline-flex overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-0.5 " +
        (className || "")
      }
      aria-label={name}
    >
      {options.map((opt) => {
        const selected = value === opt.id;
        const btn = (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            aria-pressed={selected}
            className={`h-7 rounded-lg px-3 font-mono text-[11px] font-semibold uppercase tracking-wide leading-none transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-200)] ${
              selected
                ? "bg-[var(--brand-primary)] text-[var(--text-inverse)] shadow-amber-sm"
                : "text-[var(--text-secondary)] hover:bg-[var(--surface-card)] hover:text-[var(--text-primary)]"
            }`}
          >
            {opt.label}
          </button>
        );
        return opt.tooltip ? (
          <Tooltip key={opt.id} content={opt.tooltip}>{btn}</Tooltip>
        ) : (
          <React.Fragment key={opt.id}>{btn}</React.Fragment>
        );
      })}
    </div>
  );
}
