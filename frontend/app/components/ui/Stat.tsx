import React from "react";
import Card from "@/app/components/ui/Card";

export type StatProps = {
  label: string;
  value: React.ReactNode;
  hint?: string;
  className?: string;
};

export default function Stat({ label, value, hint, className }: StatProps) {
  return (
    <Card className={"p-6 " + (className || "") }>
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-1 text-3xl font-bold tracking-tight">{value}</div>
      {hint ? <div className="mt-2 text-xs text-gray-500">{hint}</div> : null}
    </Card>
  );
}

