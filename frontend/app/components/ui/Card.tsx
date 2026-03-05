import React from "react";
import { cn } from "@/app/components/ui/utils";

export type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  inset?: boolean;
};

export default function Card({ className, inset = false, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-gray-200 bg-white shadow-soft dark:border-neutral-800 dark:bg-neutral-900",
        inset && "p-4",
        className
      )}
      {...props}
    />
  );
}

