"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import {
  createTranslator, isExcludedPath, LANGUAGE_STORAGE_KEY, readLanguage, resolveMessage,
  type Language, type MessageValue, type Translator,
} from "./messages";

export { uiMessage, frontendErrorMessage } from "./messages";
export type { Language, Translator, TranslationKey, UiMessage, MessageParams } from "./messages";

type TranslationContextValue = {
  language: Language;
  excluded: boolean;
  setLanguage: (language: Language) => void;
  t: Translator;
};
const TranslationContext = createContext<TranslationContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const excluded = isExcludedPath(pathname);
  const [language, updateLanguage] = useState<Language>("th");

  useEffect(() => {
    const timer = window.setTimeout(() => updateLanguage(readBrowserLanguage()), 0);
    const syncLanguage = (event: StorageEvent) => {
      if (event.key === LANGUAGE_STORAGE_KEY) updateLanguage(readLanguage(window.localStorage));
    };
    window.addEventListener("storage", syncLanguage);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("storage", syncLanguage);
    };
  }, []);

  const setLanguage = useCallback((next: Language) => {
    updateLanguage(next);
    try { window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next); } catch { /* Current tab still works. */ }
  }, []);

  useEffect(() => {
    document.documentElement.lang = excluded ? "th" : language;
  }, [excluded, language]);

  const value = useMemo(() => ({
    language, excluded, setLanguage, t: createTranslator(language, excluded),
  }), [language, excluded, setLanguage]);

  return <TranslationContext.Provider value={value}>{children}</TranslationContext.Provider>;
}

export function useTranslation() {
  const context = useContext(TranslationContext);
  if (!context) throw new Error("I18nProvider is required");
  return context;
}

export function Message({ value }: { value: MessageValue }) {
  const { t } = useTranslation();
  return <>{resolveMessage(value, t)}</>;
}

function readBrowserLanguage(): Language {
  try { return readLanguage(window.localStorage); } catch { return "th"; }
}
