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
        "w-full resize-none overflow-auto rounded-2xl border border-[var(--border-light)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--brand-200)] focus:ring-2 focus:ring-[var(--brand-100)]",
        className
      )}
      style={{ ...(style || {}), maxHeight }}
      {...props}
    />
  );
});

export default Textarea;
