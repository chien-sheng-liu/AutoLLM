"use client";
import React from "react";
import { cn } from "@/app/components/ui/utils";

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: 'neutral'|'brand'|'success'|'warning'|'danger';
};

export default function Badge({ className, tone = 'brand', ...props }: BadgeProps) {
  const tones: Record<string, string> = {
    neutral: 'border-[var(--border-light)] bg-[var(--surface-muted)] text-[var(--text-secondary)]',
    brand: 'border-[var(--soft-brand-border)] bg-[var(--soft-brand-background)] text-[var(--brand-primary)]',
    success: 'border-[#B8EAD3] bg-[#E8F8F1] text-[#1B7C5B]',
    warning: 'border-[#F4CE68] bg-[#FFF6E2] text-[#9B620B]',
    danger: 'border-[#F6AFC0] bg-[#FDECEF] text-[#B0364E]',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide',
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
