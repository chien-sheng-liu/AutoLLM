"use client";
import React from "react";
import Tooltip from "@/app/components/ui/Tooltip";

type Option = { id: string; label: string; tooltip?: string };

type Props = {
  options: Option[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  name?: string;
};

export default function Segmented({ options, value, onChange, className, name }: Props) {
  const n = Math.max(1, options.length);
  const idx = Math.max(0, options.findIndex((o) => o.id === value));
  const leftPct = (idx * 100) / n;
  const widthPct = 100 / n;
  return (
    <div
      className={`relative inline-grid overflow-hidden rounded-lg border border-gray-200 bg-white p-0.5 text-xs dark:border-neutral-700 dark:bg-neutral-800 ${className || ''}`}
      style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
      role="tablist"
      aria-label={name}
    >
      <span
        className="pointer-events-none absolute inset-y-0 z-0 rounded-md bg-indigo-600 shadow-sm transition-all duration-200 ease-out dark:bg-indigo-500"
        style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
        aria-hidden
      />
      {options.map((opt, i) => {
        const selected = value === opt.id || (value === undefined && i === 0);
        const btn = (
          <button
            key={opt.id}
            role="tab"
            aria-selected={selected}
            className={`relative z-10 h-7 px-2.5 leading-none rounded-md transition-colors duration-150 whitespace-nowrap ${
              selected
                ? 'text-white'
                : 'text-gray-700 hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-indigo-400 dark:text-gray-200 dark:hover:bg-neutral-700'
            }`}
            onClick={() => onChange(opt.id)}
            type="button"
            tabIndex={0}
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
