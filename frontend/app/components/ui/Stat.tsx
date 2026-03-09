"use client";
import React from "react";
import Card from "@/app/components/ui/Card";

export type StatProps = {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
};

export default function Stat({ label, value, hint, className }: StatProps) {
  return (
    <Card className={"p-4 " + (className || "")}>
      <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
      <div className="mt-1 text-xl font-semibold text-gray-900 dark:text-gray-100">{value}</div>
      {hint && <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</div>}
    </Card>
  );
}

