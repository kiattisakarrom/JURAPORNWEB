"use client";

import { useTranslation } from "./index";

export function LanguageSwitcher() {
  const { language, setLanguage, excluded, t } = useTranslation();
  if (excluded) return null;
  return (
    <div aria-label={t("common.language")} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 text-xs font-bold" role="group">
      <button aria-label={t("common.selectThai")} aria-pressed={language === "th"} className={`rounded px-2 py-1.5 ${language === "th" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"}`} onClick={() => setLanguage("th")} type="button">TH</button>
      <span aria-hidden="true" className="text-slate-300">|</span>
      <button aria-label={t("common.selectEnglish")} aria-pressed={language === "en"} className={`rounded px-2 py-1.5 ${language === "en" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"}`} onClick={() => setLanguage("en")} type="button">EN</button>
    </div>
  );
}
