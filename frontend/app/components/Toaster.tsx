"use client";
import React, { useEffect, useState } from "react";

type Toast = { id: string; title?: string; message: string; kind?: 'info' | 'success' | 'error'; duration?: number };

let listeners: ((t: Toast) => void)[] = [];
export function showToast(message: string, opts?: Omit<Toast, 'id' | 'message'>) {
  const t: Toast = { id: crypto.randomUUID(), message, ...opts };
  listeners.forEach((l) => l(t));
}

export default function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    const on = (t: Toast) => {
      setItems((prev) => [...prev, t]);
      setTimeout(() => dismiss(t.id), t.duration ?? 3000);
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
        <div key={t.id} className={`pointer-events-auto w-80 rounded-xl border px-4 py-3 shadow-soft backdrop-blur transition ${
          t.kind === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100'
            : t.kind === 'error' ? 'border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100'
            : 'border-gray-200 bg-white text-gray-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-gray-100'
        }`}>
          {t.title && <div className="text-sm font-semibold">{t.title}</div>}
          <div className="text-sm">{t.message}</div>
        </div>
      ))}
    </div>
  );
}

