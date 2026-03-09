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
    <div className={"inline-flex overflow-hidden rounded-lg border border-gray-200 bg-white p-0.5 dark:border-neutral-700 dark:bg-neutral-800 " + (className || "")} aria-label={name}>
      {options.map((opt) => {
        const selected = value === opt.id;
        const btn = (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            aria-pressed={selected}
            className={`h-7 px-3 text-[12px] leading-none rounded-md transition-all duration-150 focus-visible:ring-2 focus-visible:ring-indigo-400 ${
              selected ? 'bg-indigo-600 text-white dark:bg-indigo-500' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-neutral-700'
            }`}
          >{opt.label}</button>
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

