"use client";
import { useLanguage } from "@/app/providers/LanguageProvider";

export default function LanguageSwitcher() {
  const { language, mode, manualSelect, enableAuto, t } = useLanguage();
  const value = mode === 'auto' ? 'auto' : language;

  return (
    <div className="w-32 text-right text-[10px] text-gray-500 dark:text-gray-400">
      <div className="relative">
        <select
          aria-label={t('language.label')}
          className="w-full appearance-none rounded-lg border border-white/30 bg-white/80 px-3 py-1.5 pr-6 text-[11px] font-medium text-gray-900 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-white/20 dark:bg-black/30 dark:text-gray-100"
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
        <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-gray-500 dark:text-gray-300" aria-hidden>
          ▾
        </span>
      </div>
    </div>
  );
}
