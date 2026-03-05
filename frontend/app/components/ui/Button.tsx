"use client";
import React from "react";
import { cn } from "@/app/components/ui/utils";

type Variant = "primary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md";

export function buttonClasses({ variant = "primary", size = "md" as Size }: { variant?: Variant; size?: Size }) {
  const base =
    "inline-flex items-center justify-center select-none rounded-xl font-medium transition focus:outline-none disabled:opacity-60 disabled:pointer-events-none";
  const sizes: Record<Size, string> = {
    sm: "h-9 px-3 text-sm",
    md: "h-11 px-4 text-sm",
  };
  const variants: Record<Variant, string> = {
    primary: "bg-brand text-white shadow-soft hover:brightness-110",
    outline:
      "border border-gray-200 bg-white hover:bg-gray-50 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800",
    ghost: "hover:bg-gray-100 dark:hover:bg-neutral-800",
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

