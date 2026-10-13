"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/i18n";
import { ClipboardPlus, History, LockKeyhole, Search, ShieldAlert } from "lucide-react";

/**
 * Read-only representation of the former allergy-entry screen.
 *
 * Intentionally contains no API imports, event handlers, or local form state.
 * TBLALLERGY is owned by the hospital source system; this screen only explains
 * that contract while preserving the familiar form layout.
 */
export function DrugAllergyManager() {
  const { t } = useTranslation();

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-7">
      <div className="mx-auto mb-5 flex max-w-[1500px] items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 shadow-sm">
        <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div>
          <p className="font-black">{t("drug-master.allergyReadOnlySourceSystem")}</p>
          <p className="mt-1 text-sm font-semibold leading-5 text-amber-800">
            {t("drug-master.allergyEntryDisabledDescription")}
          </p>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1500px] gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-500">
              <ShieldAlert className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-xl font-black text-slate-950">{t("drug-master.addPatientDrugAllergy")}</h1>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
                {t("drug-master.allergyReadOnlySourceSystem")}
              </p>
            </div>
          </div>

          <fieldset className="mt-6 space-y-5 disabled:cursor-not-allowed" disabled>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <FieldTitle required>{t("drug-master.findPatient")}</FieldTitle>
              <div className="mt-2 flex gap-2">
                <Input placeholder={t("drug-master.enterHnOrPatientName")} />
                <Button type="button"><Search className="h-4 w-4" />{t("common.search")}</Button>
              </div>
            </div>

            <div>
              <FieldTitle required>{t("drug-master.allergicMedication")}</FieldTitle>
              <div className="mt-2 flex gap-2">
                <Input placeholder={t("drug-master.searchDrugCodeBrandOrGenericName")} />
                <Button type="button" variant="outline"><Search className="h-4 w-4" />{t("drug-master.findMedication")}</Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField label={t("drug-master.allergicSymptomsSideEffect")} required>
                <textarea placeholder={t("drug-master.forExampleItchyRashOrBreathingDifficulty")} />
              </FormField>
              <FormField label={t("drug-master.allergyType")} required><Input /></FormField>
              <FormField label={t("common.severity")} required><Input placeholder={t("drug-master.selectOrEnterSeverity")} /></FormField>
              <FormField label={t("drug-master.correlationLevel")} required><Input placeholder={t("drug-master.selectOrEnterCorrelation")} /></FormField>
              <FormField label={t("drug-master.reactionDetailsThai")}><textarea /></FormField>
              <FormField label={t("drug-master.reactionDetailsEnglish")}><textarea /></FormField>
              <FormField label={t("drug-master.certifiedBy")} required><Input placeholder={t("drug-master.pharmacistOrRecorderName")} /></FormField>
              <FormField label={t("common.notes")}><textarea /></FormField>
            </div>

            <div className="flex justify-end border-t border-slate-200 pt-5">
              <Button className="h-11 px-5" type="button"><ClipboardPlus className="h-4 w-4" />{t("drug-master.reviewBeforeSaving")}</Button>
            </div>
          </fieldset>
        </section>

        <section className="min-h-[360px] rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-500"><History className="h-5 w-5" /></span>
            <div>
              <h2 className="font-black text-slate-950">{t("common.drugAllergyHistory")}</h2>
              <p className="text-xs font-semibold text-slate-500">{t("drug-master.readOnlyExistingRecordsCannotBeEdited")}</p>
            </div>
          </div>
          <div className="mt-5 flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-6 text-center">
            <LockKeyhole className="h-8 w-8 text-slate-300" />
            <p className="mt-3 max-w-md text-sm font-bold leading-6 text-slate-500">
              {t("drug-master.allergyHistoryUnavailableOnDisabledPage")}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function FieldTitle({ children, required = false }: { children: React.ReactNode; required?: boolean }) {
  return <div className="text-sm font-black text-slate-500">{children}{required ? <span className="ml-1 text-red-400">*</span> : null}</div>;
}

function FormField({ children, label, required = false }: { children: React.ReactNode; label: string; required?: boolean }) {
  return (
    <label className="block text-sm font-black text-slate-500">
      {label}{required ? <span className="ml-1 text-red-400">*</span> : null}
      <div className="mt-1.5 [&_input]:font-semibold [&_textarea]:min-h-24 [&_textarea]:w-full [&_textarea]:rounded-xl [&_textarea]:border [&_textarea]:border-slate-200 [&_textarea]:bg-slate-100 [&_textarea]:p-3 [&_textarea]:text-sm [&_textarea]:font-semibold [&_textarea]:text-slate-400">
        {children}
      </div>
    </label>
  );
}
