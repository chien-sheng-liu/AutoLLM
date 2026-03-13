"use client";
import React, { useEffect, useRef } from "react";
import { cn } from "@/app/components/ui/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  autoGrow?: boolean;
  maxHeight?: number;
  onHeightChange?: (h: number) => void;
};

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, autoGrow = true, maxHeight = 220, onHeightChange, style, ...props },
  ref
) {
  const innerRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const el = innerRef.current;
    if (!el || !autoGrow) return;
    el.style.height = "auto";
    const h = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${h}px`;
    onHeightChange?.(el.offsetHeight);
  }, [props.value, autoGrow, maxHeight, onHeightChange]);

  return (
    <textarea
      ref={(node) => {
        innerRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) (ref as any).current = node;
      }}
      className={cn(
        "w-full resize-none overflow-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3 font-body text-sm text-[var(--text-primary)] outline-none transition-all placeholder:text-[var(--text-disabled)] focus:border-[var(--brand-300)] focus:ring-2 focus:ring-[var(--brand-100)] focus:bg-[var(--surface-card)]",
        className
      )}
      style={{ ...(style || {}), maxHeight }}
      {...props}
    />
  );
});

export default Textarea;
