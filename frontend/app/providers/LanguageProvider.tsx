"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_LANGUAGE, detectLanguageFromText, normalizeLanguage, translate, type Language, type LanguageMode } from '@/lib/i18n';

type LanguageContextValue = {
  language: Language;
  mode: LanguageMode;
  t: (key: string, replacements?: Record<string, string | number>) => string;
  manualSelect: (language: Language) => void;
  enableAuto: () => void;
  autoDetectFromInput: (text: string) => void;
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>(DEFAULT_LANGUAGE);
  const [mode, setMode] = useState<LanguageMode>('auto');

  useEffect(() => {
    try {
      const storedLang = localStorage.getItem('autollm.language');
      const storedMode = localStorage.getItem('autollm.language.mode') as LanguageMode | null;
      if (storedLang) setLanguage(normalizeLanguage(storedLang));
      if (storedMode === 'manual' || storedMode === 'auto') {
        setMode(storedMode);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('autollm.language', language);
      localStorage.setItem('autollm.language.mode', mode);
    } catch {}
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
      document.documentElement.dataset.languageMode = mode;
    }
  }, [language, mode]);

  const manualSelect = useCallback((lang: Language) => {
    setLanguage(lang);
    setMode('manual');
  }, []);

  const enableAuto = useCallback(() => {
    setMode('auto');
  }, []);

  const autoDetectFromInput = useCallback((text: string) => {
    if (mode !== 'auto') return;
    const detected = detectLanguageFromText(text);
    if (detected && detected !== language) {
      setLanguage(detected);
    }
  }, [language, mode]);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    mode,
    t: (key, replacements) => translate(language, key, replacements),
    manualSelect,
    enableAuto,
    autoDetectFromInput,
  }), [language, mode, manualSelect, enableAuto, autoDetectFromInput]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
