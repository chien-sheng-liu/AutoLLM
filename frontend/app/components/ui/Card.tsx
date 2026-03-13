import React from "react";
import { cn } from "@/app/components/ui/utils";

export type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  inset?: boolean;
};

export default function Card({ className, inset = false, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--border-light)] bg-[var(--surface)] text-[var(--text-primary)] shadow-surface",
        inset && "p-4",
        className
      )}
      {...props}
    />
  );
}
