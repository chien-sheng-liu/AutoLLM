"use client";
import { useState } from "react";
import type { DocumentItem } from "@/lib/api";

type Props = {
  docs: DocumentItem[];
  selectedIds: string[] | null; // null = all docs selected
  onChange: (ids: string[] | null) => void;
};

export default function DocumentScopeSelector({ docs, selectedIds, onChange }: Props) {
  const [open, setOpen] = useState(false);

  if (docs.length === 0) return null;

  const allSelected = selectedIds === null;
  const count = allSelected ? docs.length : selectedIds.length;

  function toggleAll() {
    onChange(null); // null = all
  }

  function toggleDoc(id: string) {
    if (allSelected) {
      // Deselect one: select all except this one
      const rest = docs.map((d) => d.document_id).filter((d) => d !== id);
      onChange(rest.length === 0 ? null : rest);
      return;
    }
    if (selectedIds!.includes(id)) {
      const next = selectedIds!.filter((d) => d !== id);
      onChange(next.length === 0 ? null : next);
    } else {
      const next = [...selectedIds!, id];
      onChange(next.length === docs.length ? null : next);
    }
  }

  function isSelected(id: string) {
    return allSelected || selectedIds!.includes(id);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
          allSelected
            ? "border-[var(--border-light)] bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:border-[var(--border-subtle)]"
            : "border-[var(--soft-brand-border)] bg-[var(--soft-brand-background)] text-[var(--brand-primary)]"
        }`}
      >
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="9" y1="13" x2="15" y2="13" />
        </svg>
        <span>
          {allSelected ? `全部文件 (${docs.length})` : `${count} / ${docs.length} 文件`}
        </span>
        <svg
          width="9"
          height="9"
          viewBox="0 0 10 10"
          fill="currentColor"
          className={`shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        >
          <path d="M2 3l3 4 3-4H2z" />
        </svg>
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[70]"
            onClick={() => setOpen(false)}
          />
          {/* Dropdown */}
          <div className="absolute bottom-full left-0 z-[71] mb-2 w-72 overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-soft-md animate-fade-up">
            <div className="flex items-center justify-between border-b border-[var(--border-light)] px-3.5 py-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--text-muted)]">
                RAG 知識文件範圍
              </span>
              <button
                type="button"
                onClick={toggleAll}
                className={`text-[11px] font-semibold transition ${
                  allSelected
                    ? "text-[var(--brand-primary)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                {allSelected ? "已全選" : "全選"}
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto px-2 py-2">
              {docs.map((doc) => {
                const sel = isSelected(doc.document_id);
                return (
                  <button
                    key={doc.document_id}
                    type="button"
                    onClick={() => toggleDoc(doc.document_id)}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition ${
                      sel
                        ? "bg-[var(--soft-brand-background)] text-[var(--text-primary)]"
                        : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                    }`}
                  >
                    {/* Checkbox */}
                    <span
                      className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                        sel
                          ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]"
                          : "border-[var(--border-strong)] bg-transparent"
                      }`}
                    >
                      {sel && (
                        <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="2 6 5 9 10 3" />
                        </svg>
                      )}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12px]">{doc.name}</span>
                  </button>
                );
              })}
            </div>

            {!allSelected && (
              <div className="border-t border-[var(--border-light)] px-3 py-2 text-[10px] text-[var(--text-muted)]">
                僅從選取的 {count} 份文件進行 RAG 檢索
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
