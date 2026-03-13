"use client";
import React from "react";
import { cn } from "@/app/components/ui/utils";

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger';
};

export default function Badge({ className, tone = 'brand', ...props }: BadgeProps) {
  const tones: Record<string, string> = {
    neutral: 'border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-secondary)]',
    brand:   'border-[var(--soft-brand-border)] bg-[var(--soft-brand-background)] text-[var(--brand-primary)]',
    success: 'border-[rgba(44,200,138,0.25)] bg-[var(--success-soft)] text-[var(--success)]',
    warning: 'border-[rgba(240,161,64,0.25)] bg-[var(--warning-soft)] text-[var(--warning)]',
    danger:  'border-[rgba(232,80,106,0.25)] bg-[var(--danger-soft)] text-[var(--danger)]',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest',
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
