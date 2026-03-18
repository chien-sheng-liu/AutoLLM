"use client";
import { useState, useRef, useEffect } from "react";
import { useTheme } from "@/app/providers/ThemeProvider";

export default function SettingsFAB() {
  const { theme, setTheme, fontSize, setFontSize } = useTheme();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div
      ref={panelRef}
      className="fixed bottom-6 right-6 z-[80] flex flex-col items-end gap-2"
    >
      {/* Panel */}
      {open && (
        <div className="mb-1 w-56 overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-soft-md animate-fade-up">
          <div className="border-b border-[var(--border-light)] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[var(--text-muted)]">
              顯示設定
            </p>
          </div>

          <div className="space-y-4 px-4 py-4">
            {/* Theme */}
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--text-muted)]">
                主題
              </p>
              <div className="flex gap-1.5">
                {(
                  [
                    {
                      id: "dark" as const,
                      label: "暗色",
                      icon: (
                        <svg
                          width="11"
                          height="11"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                        </svg>
                      ),
                    },
                    {
                      id: "light" as const,
                      label: "亮色",
                      icon: (
                        <svg
                          width="11"
                          height="11"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="12" cy="12" r="5" />
                          <line x1="12" y1="1" x2="12" y2="3" />
                          <line x1="12" y1="21" x2="12" y2="23" />
                          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                          <line x1="1" y1="12" x2="3" y2="12" />
                          <line x1="21" y1="12" x2="23" y2="12" />
                          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                        </svg>
                      ),
                    },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTheme(t.id)}
                    aria-pressed={theme === t.id}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 text-[12px] font-semibold transition ${
                      theme === t.id
                        ? "bg-[var(--brand-primary)] text-white"
                        : "bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:bg-[var(--surface-soft)]"
                    }`}
                  >
                    {t.icon}
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Font size */}
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--text-muted)]">
                字體大小
              </p>
              <div className="flex gap-1.5">
                {(
                  [
                    { id: "small" as const, label: "小", size: "text-[11px]" },
                    {
                      id: "medium" as const,
                      label: "中",
                      size: "text-[13px]",
                    },
                    { id: "large" as const, label: "大", size: "text-[15px]" },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFontSize(f.id)}
                    aria-pressed={fontSize === f.id}
                    className={`flex-1 rounded-full py-1.5 font-semibold transition ${f.size} ${
                      fontSize === f.id
                        ? "bg-[var(--brand-primary)] text-white"
                        : "bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:bg-[var(--surface-soft)]"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FAB button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="顯示設定"
        aria-expanded={open}
        className={`inline-flex h-12 w-12 items-center justify-center rounded-full border shadow-soft-md transition-all duration-200 ${
          open
            ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white scale-95"
            : "border-[var(--soft-brand-border)] bg-[var(--surface)] text-[var(--brand-primary)] hover:bg-[var(--soft-brand-background)] hover:scale-105"
        }`}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="18" x2="20" y2="18" />
          <circle cx="8" cy="6" r="2" fill="currentColor" stroke="none" />
          <circle cx="16" cy="12" r="2" fill="currentColor" stroke="none" />
          <circle cx="10" cy="18" r="2" fill="currentColor" stroke="none" />
        </svg>
      </button>
    </div>
  );
}
