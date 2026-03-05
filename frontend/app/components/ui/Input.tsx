"use client";
import React from "react";
import { cn } from "@/app/components/ui/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-neutral-800 dark:bg-neutral-900",
        className
      )}
      {...props}
    />
  );
});

export default Input;

