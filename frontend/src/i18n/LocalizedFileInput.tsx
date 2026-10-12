"use client";

import { useState } from "react";
import { useTranslation } from "./index";

export function LocalizedFileInput({ accept, onChange }: { accept: string; onChange: (file: File | undefined) => void }) {
  const { t } = useTranslation();
  const [filename, setFilename] = useState("");
  return (
    <span className="relative mt-2 flex min-w-0 items-center gap-2 rounded-lg text-xs font-normal focus-within:ring-2 focus-within:ring-blue-400">
      <span className="shrink-0 rounded-lg bg-blue-50 px-3 py-2 font-bold text-blue-700">{t("common.chooseFile")}</span>
      <span className="min-w-0 truncate text-slate-500">{filename || t("common.noFileChosen")}</span>
      <input accept={accept} aria-label={t("common.chooseFile")} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" onChange={event => {
        const file = event.target.files?.[0];
        setFilename(file?.name ?? "");
        onChange(file);
      }} type="file" />
    </span>
  );
}
