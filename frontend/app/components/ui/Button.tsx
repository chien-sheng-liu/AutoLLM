"use client";
import React from "react";
import { cn } from "@/app/components/ui/utils";

type Variant = "primary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md";

export function buttonClasses({ variant = "primary", size = "md" as Size }: { variant?: Variant; size?: Size }) {
  const base =
    "inline-flex items-center justify-center select-none rounded-xl font-medium transition focus:outline-none disabled:opacity-60 disabled:pointer-events-none whitespace-nowrap";
  const sizes: Record<Size, string> = {
    sm: "h-9 px-3 text-sm",
    md: "h-11 px-4 text-sm",
  };
  const variants: Record<Variant, string> = {
    primary: "bg-gradient-to-tr from-indigo-600 via-violet-600 to-fuchsia-600 text-white shadow-glow hover:brightness-110 hover:-translate-y-[1px] active:translate-y-0",
    outline:
      "border border-white/30 bg-white/60 backdrop-blur-md hover:bg-white/80 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10",
    ghost: "hover:bg-white/50 dark:hover:bg-white/10",
    danger:
      "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-900/40",
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
