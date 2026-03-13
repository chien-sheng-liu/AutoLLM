"use client";
import React from "react";
import { cn } from "@/app/components/ui/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-2.5 text-sm font-body text-[var(--text-primary)] outline-none transition-all placeholder:text-[var(--text-disabled)] focus:border-[var(--brand-300)] focus:ring-2 focus:ring-[var(--brand-100)] focus:bg-[var(--surface-card)]",
        className
      )}
      {...props}
    />
  );
});

export default Input;
