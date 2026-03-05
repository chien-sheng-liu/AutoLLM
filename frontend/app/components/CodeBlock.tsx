"use client";
import { useEffect, useRef } from "react";
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import bash from "highlight.js/lib/languages/bash";
import jsonLang from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import "highlight.js/styles/github-dark.css";
import { showToast } from "@/app/components/Toaster";

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('json', jsonLang);
hljs.registerLanguage('markdown', markdown);

export default function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const ref = useRef<HTMLElement>(null);
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
      showToast('已複製到剪貼簿', { kind: 'success' });
    }).catch(() => showToast('複製失敗', { kind: 'error' }));
  }

  return (
    <div className="relative">
      <pre className="rounded-xl border border-gray-200 bg-neutral-900 p-3 text-neutral-100 dark:border-neutral-800">
        <code ref={ref} />
      </pre>
      <button onClick={copy} className="absolute right-2 top-2 rounded-md border border-gray-700/40 bg-neutral-800/60 px-2 py-1 text-xs text-gray-200 hover:bg-neutral-700">複製</button>
    </div>
  );
}
