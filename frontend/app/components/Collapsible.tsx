"use client";
import React, { useEffect, useRef, useState } from "react";

type Props = {
  open: boolean;
  children: React.ReactNode;
  className?: string;
  durationMs?: number;
};

export default function Collapsible({ open, children, className, durationMs = 200 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [maxH, setMaxH] = useState<number>(open ? 9999 : 0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const h = el.scrollHeight;
    if (open) {
      setMaxH(h);
      const id = window.setTimeout(() => setMaxH(9999), durationMs + 50);
      return () => window.clearTimeout(id);
    } else {
      setMaxH(h);
      requestAnimationFrame(() => setMaxH(0));
    }
  }, [open, children, durationMs]);
  return (
    <div
      className={className}
      style={{
        maxHeight: maxH,
        overflow: "hidden",
        transition: `max-height ${durationMs}ms ease-in-out, opacity ${durationMs}ms ease-in-out`,
        opacity: open ? 1 : 0.95,
      }}
    >
      <div ref={ref}>{children}</div>
    </div>
  );
}

