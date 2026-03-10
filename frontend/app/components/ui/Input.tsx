"use client";
import React from "react";
import { cn } from "@/app/components/ui/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-2xl border border-[var(--border-light)] bg-[var(--surface-muted)] px-4 py-2 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--brand-200)] focus:ring-2 focus:ring-[var(--brand-100)]",
        className
      )}
      {...props}
    />
  );
});

export default Input;
