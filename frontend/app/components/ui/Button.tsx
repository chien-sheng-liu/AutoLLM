"use client";
import React from "react";
import { cn } from "@/app/components/ui/utils";

type Variant = "primary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md";

export function buttonClasses({ variant = "primary", size = "md" as Size }: { variant?: Variant; size?: Size }) {
  const base =
    "inline-flex items-center justify-center select-none rounded-xl font-semibold font-body transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-300)] disabled:pointer-events-none disabled:opacity-40 whitespace-nowrap";
  const sizes: Record<Size, string> = {
    sm: "h-8 px-3 text-xs tracking-wide",
    md: "h-10 px-4 text-sm tracking-wide",
  };
  const variants: Record<Variant, string> = {
    primary:
      "bg-[var(--brand-primary)] text-[var(--text-inverse)] shadow-brand hover:bg-[var(--brand-hover)] active:bg-[var(--brand-active)] hover:-translate-y-px active:translate-y-0",
    outline:
      "border border-[var(--border-strong)] bg-[var(--surface-muted)] text-[var(--text-primary)] hover:border-[var(--border-subtle)] hover:bg-[var(--surface-soft)]",
    ghost:
      "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]",
    danger:
      "border border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)] hover:bg-[rgba(232,80,106,0.18)]",
  };
  return cn(base, sizes[size], variants[variant]);
}

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", ...props },
  ref
) {
  return <button ref={ref} className={cn(buttonClasses({ variant, size }), className)} {...props} />;
});

export default Button;
