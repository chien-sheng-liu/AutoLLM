"use client";
import React from "react";
import { cn } from "@/app/components/ui/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-xl border border-white/30 bg-white/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400 backdrop-blur-md dark:border-white/10 dark:bg-white/5",
        className
      )}
      {...props}
    />
  );
});

export default Input;
