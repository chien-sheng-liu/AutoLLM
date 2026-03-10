"use client";
import React from "react";
import { cn } from "@/app/components/ui/utils";

type Variant = "primary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md";

export function buttonClasses({ variant = "primary", size = "md" as Size }: { variant?: Variant; size?: Size }) {
  const base =
    "inline-flex items-center justify-center select-none rounded-2xl font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-200)] disabled:pointer-events-none disabled:opacity-60 whitespace-nowrap";
  const sizes: Record<Size, string> = {
    sm: "h-9 px-3 text-sm",
    md: "h-11 px-4 text-sm",
  };
  const variants: Record<Variant, string> = {
    primary: "bg-[var(--brand-primary)] text-white shadow-brand transition-transform hover:-translate-y-[1px] hover:bg-[var(--brand-hover)] active:translate-y-0 active:bg-[var(--brand-active)]",
    outline:
      "border border-[var(--border-strong)] bg-[var(--surface-muted)] text-[var(--text-primary)] hover:bg-[var(--surface-panel)]",
    ghost: "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]",
    danger:
      "border border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)] hover:bg-[var(--danger-soft)]/80",
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
