import React from "react";
import { cn } from "@/app/components/ui/utils";

export type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  inset?: boolean;
};

export default function Card({ className, inset = false, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/30 bg-white/70 shadow-soft backdrop-blur-md dark:border-white/10 dark:bg-white/5",
        inset && "p-4",
        className
      )}
      {...props}
    />
  );
}
