"use client";
import React from "react";

export type StatProps = {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
};

export default function Stat({ label, value, hint, className }: StatProps) {
  return (
    <div className={`rounded-xl border border-[var(--border-light)] bg-[var(--surface)] p-4 ${className || ""}`}>
      <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">{label}</div>
      <div className="mt-2 font-display text-2xl font-bold tracking-tight text-[var(--text-primary)]">{value}</div>
      {hint && <div className="mt-1 font-body text-xs text-[var(--text-muted)]">{hint}</div>}
    </div>
  );
}
