"use client";
import { useEffect, useRef } from "react";
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import bash from "highlight.js/lib/languages/bash";
import jsonLang from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import "highlight.js/styles/github.css";
import { showToast } from "@/app/components/Toaster";
import { useLanguage } from "@/app/providers/LanguageProvider";

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('json', jsonLang);
hljs.registerLanguage('markdown', markdown);

export default function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const ref = useRef<HTMLElement>(null);
  const { t } = useLanguage();
  useEffect(() => {
    if (ref.current) {
      try {
        if (lang && hljs.getLanguage(lang)) {
          ref.current.innerHTML = hljs.highlight(code, { language: lang }).value;
        } else {
          ref.current.innerHTML = hljs.highlightAuto(code).value;
        }
      } catch {
        ref.current.textContent = code;
      }
    }
  }, [code, lang]);

  function copy() {
    navigator.clipboard.writeText(code).then(() => {
      showToast(t('common.copied'), { kind: 'success' });
    }).catch(() => showToast(t('common.copyFailed'), { kind: 'error' }));
  }

  return (
    <div className="relative">
      {(lang || '').length > 0 && (
        <div className="pointer-events-none absolute left-2 top-2 rounded-full border border-[var(--border-light)] bg-[var(--surface)] px-2 py-0.5 text-[11px] uppercase tracking-wide text-[var(--text-secondary)] shadow-surface">
          {lang}
        </div>
      )}
      <pre className="overflow-auto rounded-2xl border border-[var(--border-light)] bg-[var(--surface-muted)] p-3 text-[var(--text-primary)]">
        <code ref={ref} />
      </pre>
      <button
        onClick={copy}
        className="absolute right-2 top-2 rounded-lg border border-[var(--border-light)] bg-[var(--surface)] px-2 py-0.5 text-xs text-[var(--text-secondary)] shadow-surface hover:bg-[var(--surface-panel)]"
      >
        {t('code.copy')}
      </button>
    </div>
  );
}
