import React from "react";
import { cn } from "@/app/components/ui/utils";

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "neutral" | "brand";
};

export default function Badge({ className, variant = "neutral", ...props }: BadgeProps) {
  const base = "inline-flex items-center rounded-full border px-3 py-1 text-xs";
  const styles =
    variant === "brand"
      ? "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900/40 dark:bg-indigo-950/40 dark:text-indigo-200"
      : "border-gray-200 text-gray-700 dark:border-neutral-700 dark:text-gray-300";
  return <span className={cn(base, styles, className)} {...props} />;
}

