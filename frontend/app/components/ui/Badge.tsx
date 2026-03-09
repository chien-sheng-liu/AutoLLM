"use client";
import React from "react";
import { cn } from "@/app/components/ui/utils";

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: 'neutral'|'brand'|'success'|'warning'|'danger';
};

export default function Badge({ className, tone = 'brand', ...props }: BadgeProps) {
  const tones: Record<string, string> = {
    neutral: 'border-white/20 bg-white/10 text-white/90',
    brand: 'border-violet-300/30 bg-violet-500/10 text-violet-200',
    success: 'border-emerald-300/30 bg-emerald-500/10 text-emerald-200',
    warning: 'border-amber-300/30 bg-amber-500/10 text-amber-200',
    danger: 'border-rose-300/30 bg-rose-500/10 text-rose-200',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-wide backdrop-blur-md',
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

