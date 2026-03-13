"use client";
import React, { useEffect, useState } from "react";

type Toast = {
  id: string;
  title?: string;
  message: string;
  kind?: "info" | "success" | "error";
  duration?: number;
};

let listeners: ((t: Toast) => void)[] = [];
export function showToast(
  message: string,
  opts?: Omit<Toast, "id" | "message">,
) {
  const t: Toast = { id: crypto.randomUUID(), message, ...opts };
  listeners.forEach((l) => l(t));
}

const kindStyles: Record<string, string> = {
  success: "border-[var(--success)] bg-[var(--success-soft)] text-[var(--success)]",
  error:   "border-[var(--danger)]  bg-[var(--danger-soft)]  text-[var(--danger)]",
  info:    "border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-primary)]",
};

const kindIcon: Record<string, string> = {
  success: "✓",
  error:   "✕",
  info:    "i",
};

export default function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);

  useEffect(() => {
    const on = (t: Toast) => {
      setItems((prev) => [...prev, t]);
      setTimeout(() => dismiss(t.id), t.duration ?? 3500);
    };
    listeners.push(on);
    return () => { listeners = listeners.filter((l) => l !== on); };
  }, []);

  function dismiss(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[9999] grid gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={`pointer-events-auto flex w-80 items-start gap-3 rounded-xl border px-4 py-3 shadow-soft backdrop-blur-md cursor-pointer animate-fade-up ${kindStyles[t.kind ?? "info"]}`}
        >
          <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-current font-mono text-[10px] font-semibold">
            {kindIcon[t.kind ?? "info"]}
          </span>
          <div>
            {t.title && <div className="font-display text-sm font-semibold leading-tight">{t.title}</div>}
            <div className="font-body text-sm leading-snug">{t.message}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
