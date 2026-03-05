"use client";
import React, { useEffect, useRef } from "react";
import { cn } from "@/app/components/ui/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  autoGrow?: boolean;
  maxHeight?: number;
  onHeightChange?: (h: number) => void;
};

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, autoGrow = true, maxHeight = 220, onHeightChange, ...props },
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
        "w-full max-h-52 resize-none overflow-auto rounded-xl border border-gray-200 bg-white px-3 py-3 outline-none focus:ring-2 focus:ring-indigo-400 dark:border-neutral-800 dark:bg-neutral-900",
        className
      )}
      {...props}
    />
  );
});

export default Textarea;

