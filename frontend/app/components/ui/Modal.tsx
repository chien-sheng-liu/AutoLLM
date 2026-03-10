"use client";
import React, { useEffect } from "react";
import { cn } from "@/app/components/ui/utils";
import Button from "@/app/components/ui/Button";

export type ModalProps = {
  open: boolean;
  title?: string;
  onClose: () => void;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
};

export default function Modal({ open, title, onClose, children, footer, className }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(18,28,48,0.35)] p-4" onClick={onClose}>
      <div
        className={cn(
          "w-full max-w-md rounded-3xl border border-[var(--border-strong)] bg-[var(--surface)] p-6 shadow-panel",
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {title && <div className="text-base font-semibold text-[var(--text-primary)]">{title}</div>}
        {children && <div className="mt-2 text-sm text-[var(--text-secondary)]">{children}</div>}
        {footer !== undefined ? (
          <div className="mt-4 flex justify-end gap-2">{footer}</div>
        ) : (
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              取消
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
