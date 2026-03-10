"use client";
import { useLanguage } from "@/app/providers/LanguageProvider";

export default function LanguageSwitcher() {
  const { language, mode, manualSelect, enableAuto, t } = useLanguage();
  const value = mode === 'auto' ? 'auto' : language;

  return (
    <div className="w-32 text-right text-[10px] text-[var(--text-muted)]">
      <div className="relative">
        <select
          aria-label={t('language.label')}
          className="w-full appearance-none rounded-xl border border-[var(--border-light)] bg-[var(--surface-muted)] px-3 py-1.5 pr-6 text-[11px] font-medium text-[var(--text-primary)] shadow-surface focus:border-[var(--brand-200)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-100)]"
          value={value}
          onChange={(e) => {
            const next = e.target.value;
            if (next === 'auto') {
              enableAuto();
              return;
            }
            manualSelect(next === 'zh' ? 'zh' : 'en');
          }}
        >
          <option value="auto">{t('language.auto')}</option>
          <option value="en">{t('language.english')}</option>
          <option value="zh">{t('language.chinese')}</option>
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[var(--text-muted)]" aria-hidden>
          ▾
        </span>
      </div>
    </div>
  );
}
