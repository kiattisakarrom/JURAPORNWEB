"use client";

import { LanguageSwitcher } from "@/i18n/LanguageSwitcher";

import { frontendErrorMessage, uiMessage, type Translator, useTranslation } from "@/i18n";

import {
  AlertTriangle,
  CheckCircle2,
  ClipboardPlus,
  History,
  Loader2,
  Search,
  ShieldAlert,
  UserRound,
  X,
} from "lucide-react";
import { FormEvent, useMemo, useRef, useState } from "react";
import { uiToast as toast } from "@/i18n/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError } from "@/lib/api-client";
import {
  createDrugAllergy,
  getDrugAllergyHistory,
  searchDrugAllergyMedicines,
  searchDrugAllergyPatients,
  type CreateDrugAllergyInput,
  type DrugAllergyHistory,
  type DrugAllergyMedicine,
  type DrugAllergyPatient,
} from "@/lib/drug-allergy-api";
import { cn } from "@/lib/utils";

type AllergyForm = Omit<CreateDrugAllergyInput, "patientId" | "medicineCode">;

const emptyForm: AllergyForm = {
  sideEffect: "",
  allergyType: "Drug Allergy",
  severity: "",
  adverseReactionLocal: "",
  adverseReactionEnglish: "",
  correlationLevel: "",
  certifiedBy: "",
  remarks: "",
};

const severitySuggestions = ["Mild", "Moderate", "Severe"];
const correlationSuggestions = ["Certain", "Probable", "Possible", "Unlikely"];

export function DrugAllergyManager() {
  const { t } = useTranslation();
  const historyRequestRef = useRef(0);
  const [patientQuery, setPatientQuery] = useState("");
  const [patientResults, setPatientResults] = useState<DrugAllergyPatient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<DrugAllergyPatient | null>(null);
  const [patientSearching, setPatientSearching] = useState(false);
  const [medicineQuery, setMedicineQuery] = useState("");
  const [medicineResults, setMedicineResults] = useState<DrugAllergyMedicine[]>([]);
  const [selectedMedicine, setSelectedMedicine] = useState<DrugAllergyMedicine | null>(null);
  const [medicineSearching, setMedicineSearching] = useState(false);
  const [history, setHistory] = useState<DrugAllergyHistory | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [form, setForm] = useState<AllergyForm>(emptyForm);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);

  const canSubmit = useMemo(() => Boolean(
    selectedPatient
    && selectedMedicine
    && form.sideEffect.trim()
    && form.allergyType.trim()
    && form.severity.trim()
    && form.correlationLevel.trim()
    && form.certifiedBy.trim(),
  ), [form, selectedMedicine, selectedPatient]);

  async function selectPatient(patient: DrugAllergyPatient) {
    const requestId = ++historyRequestRef.current;
    setHistory(null);
    setSelectedMedicine(null);
    setMedicineQuery("");
    setMedicineResults([]);
    setForm(emptyForm);
    setConfirming(false);
    setSelectedPatient(patient);
    setPatientResults([]);
    setPatientQuery(`${patient.PATIENTID} — ${patient.FULLNAME_TH ?? "ไม่ระบุชื่อ"}`);
    setHistoryLoading(true);
    try {
      const result = await getDrugAllergyHistory(patient.PATIENTID);
      if (historyRequestRef.current === requestId) setHistory(result);
    } catch (reason) {
      if (historyRequestRef.current === requestId) toast.error(readError(reason));
    } finally {
      if (historyRequestRef.current === requestId) setHistoryLoading(false);
    }
  }

  function clearSelectedPatient() {
    historyRequestRef.current += 1;
    setSelectedPatient(null);
    setHistory(null);
    setSelectedMedicine(null);
    setMedicineQuery("");
    setMedicineResults([]);
    setForm(emptyForm);
    setConfirming(false);
  }

  async function findPatients(event: FormEvent) {
    event.preventDefault();
    const query = patientQuery.trim();
    if (!query) return;
    setPatientSearching(true);
    setPatientResults([]);
    try {
      const result = await searchDrugAllergyPatients(query);
      setPatientResults(result);
      if (result.length === 0) toast.info(uiMessage("drug-master.noPatientsMatchThisSearch"));
    } catch (reason) {
      toast.error(readError(reason));
    } finally {
      setPatientSearching(false);
    }
  }

  async function findMedicines() {
    const query = medicineQuery.trim();
    if (!selectedPatient || !query) return;
    setMedicineSearching(true);
    setMedicineResults([]);
    try {
      const result = await searchDrugAllergyMedicines(query);
      setMedicineResults(result);
      if (result.length === 0) toast.info(uiMessage("drug-master.noMedicationsMatchThisSearch"));
    } catch (reason) {
      toast.error(readError(reason));
    } finally {
      setMedicineSearching(false);
    }
  }

  function requestConfirmation(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) {
      toast.error(uiMessage("drug-master.completeRequiredFieldsAndSelectAPatient"));
      return;
    }
    setConfirming(true);
  }

  async function save() {
    if (!selectedPatient || !selectedMedicine || !canSubmit) return;
    setSaving(true);
    try {
      await createDrugAllergy({
        patientId: selectedPatient.PATIENTID,
        medicineCode: selectedMedicine.MEDICINECODE,
        ...form,
      });
      const nextHistory = await getDrugAllergyHistory(selectedPatient.PATIENTID);
      setHistory(nextHistory);
      setSelectedMedicine(null);
      setMedicineQuery("");
      setMedicineResults([]);
      setForm(emptyForm);
      setConfirming(false);
      toast.success(uiMessage("drug-master.allergySavedAiAlertsWillUpdateThrough"));
    } catch (reason) {
      toast.error(readError(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-7">
      <div className="mx-auto grid max-w-[1500px] gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-red-50 text-red-600"><ShieldAlert className="h-5 w-5" /></span>
            <div>
              <h1 className="text-xl font-black text-slate-950">{t("drug-master.addPatientDrugAllergy")}</h1>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">{t("drug-master.theAllergyWillBeRegisteredAndAn")}</p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <FieldTitle required>{t("drug-master.findPatient")}</FieldTitle>
            <form className="mt-2 flex gap-2" onSubmit={findPatients}>
              <Input maxLength={100} onChange={(event) => { setPatientQuery(event.target.value); if (selectedPatient) clearSelectedPatient(); }} placeholder={t("drug-master.enterHnOrPatientName")} value={selectedPatient && !selectedPatient.FULLNAME_TH ? `${selectedPatient.PATIENTID} — ${t("drug-master.nameUnspecified")}` : patientQuery} />
              <Button disabled={patientSearching || !patientQuery.trim()} type="submit">
                {patientSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}{t("common.search")}</Button>
            </form>
            {patientResults.length > 0 ? (
              <div className="mt-3 max-h-52 space-y-2 overflow-y-auto">
                {patientResults.map((patient) => (
                  <button
                    className={cn("flex w-full items-center justify-between rounded-xl border bg-white px-4 py-3 text-left transition", selectedPatient?.PATIENTID === patient.PATIENTID ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-blue-300")}
                    key={patient.PATIENTID}
                    onClick={() => void selectPatient(patient)}
                    type="button"
                  >
                    <span><span className="block text-sm font-black text-slate-900">{patient.FULLNAME_TH ?? t("common.patientNameUnspecified")}</span><span className="mt-0.5 block font-mono text-xs font-bold text-slate-500">{t("common.hn")} {patient.PATIENTID}</span></span>
                    <CheckCircle2 className="h-5 w-5 text-blue-600" />
                  </button>
                ))}
              </div>
            ) : null}
            {selectedPatient ? (
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                <UserRound className="h-5 w-5 text-blue-600" />
                <div className="min-w-0 flex-1"><div className="truncate font-black text-slate-900">{selectedPatient.FULLNAME_TH ?? t("common.patientNameUnspecified")}</div><div className="font-mono text-xs font-bold text-blue-700">{t("common.hn")} {selectedPatient.PATIENTID}</div></div>
                <button aria-label={t("drug-master.changePatient")} className="rounded-lg p-1.5 text-slate-500 hover:bg-white" onClick={() => { clearSelectedPatient(); setPatientQuery(""); }} type="button"><X className="h-4 w-4" /></button>
              </div>
            ) : null}
          </div>

          <form className="mt-5 space-y-5" onSubmit={requestConfirmation}>
            <div>
              <FieldTitle required>{t("drug-master.allergicMedication")}</FieldTitle>
              <div className="mt-2 flex gap-2">
                <Input disabled={!selectedPatient} maxLength={100} onChange={(event) => { setMedicineQuery(event.target.value); setSelectedMedicine(null); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void findMedicines(); } }} placeholder={t("drug-master.searchDrugCodeBrandOrGenericName")} value={medicineQuery} />
                <Button disabled={!selectedPatient || medicineSearching || !medicineQuery.trim()} onClick={() => void findMedicines()} type="button" variant="outline">
                  {medicineSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}{t("drug-master.findMedication")}</Button>
              </div>
              {medicineResults.length > 0 ? (
                <div className="mt-2 max-h-56 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
                  {medicineResults.map((medicine) => (
                    <button className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left hover:border-blue-400 hover:bg-blue-50" key={medicine.MEDICINECODE} onClick={() => { setSelectedMedicine(medicine); setMedicineQuery(medicineLabel(medicine, t)); setMedicineResults([]); }} type="button">
                      <span className="block text-sm font-black text-slate-900">{medicine.COMMERCIALNAME || medicine.LOCALNAME || medicine.GENERICNAME || medicine.MEDICINECODE}</span>
                      <span className="mt-1 block font-mono text-xs font-bold text-slate-500">{medicine.MEDICINECODE}{medicine.STRENGTH ? ` · ${medicine.STRENGTH}` : ""}</span>
                    </button>
                  ))}
                </div>
              ) : null}
              {selectedMedicine ? <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">{t("drug-master.selected")} {medicineLabel(selectedMedicine, t)}</div> : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField label={t("drug-master.allergicSymptomsSideEffect")} required><textarea maxLength={1000} onChange={(event) => updateForm(setForm, "sideEffect", event.target.value)} placeholder={t("drug-master.forExampleItchyRashOrBreathingDifficulty")} value={form.sideEffect} /></FormField>
              <FormField label={t("drug-master.allergyType")} required><Input list="allergy-types" maxLength={100} onChange={(event) => updateForm(setForm, "allergyType", event.target.value)} value={form.allergyType} /><datalist id="allergy-types"><option value="Drug Allergy" /><option value="Drug Intolerance" /></datalist></FormField>
              <FormField label={t("common.severity")} required><Input list="allergy-severity" maxLength={100} onChange={(event) => updateForm(setForm, "severity", event.target.value)} placeholder={t("drug-master.selectOrEnterSeverity")} value={form.severity} /><datalist id="allergy-severity">{severitySuggestions.map((item) => <option key={item} value={item} />)}</datalist></FormField>
              <FormField label={t("drug-master.correlationLevel")} required><Input list="allergy-correlation" maxLength={100} onChange={(event) => updateForm(setForm, "correlationLevel", event.target.value)} placeholder={t("drug-master.selectOrEnterCorrelation")} value={form.correlationLevel} /><datalist id="allergy-correlation">{correlationSuggestions.map((item) => <option key={item} value={item} />)}</datalist></FormField>
              <FormField label={t("drug-master.reactionDetailsThai")}><textarea maxLength={2000} onChange={(event) => updateForm(setForm, "adverseReactionLocal", event.target.value)} value={form.adverseReactionLocal} /></FormField>
              <FormField label={t("drug-master.reactionDetailsEnglish")}><textarea maxLength={2000} onChange={(event) => updateForm(setForm, "adverseReactionEnglish", event.target.value)} value={form.adverseReactionEnglish} /></FormField>
              <FormField label={t("drug-master.certifiedBy")} required><Input maxLength={150} onChange={(event) => updateForm(setForm, "certifiedBy", event.target.value)} placeholder={t("drug-master.pharmacistOrRecorderName")} value={form.certifiedBy} /></FormField>
              <FormField label={t("common.notes")}><textarea maxLength={4000} onChange={(event) => updateForm(setForm, "remarks", event.target.value)} value={form.remarks} /></FormField>
            </div>

            <div className="flex justify-end border-t border-slate-200 pt-5">
              <Button className="h-11 px-5" disabled={!canSubmit || saving} type="submit"><ClipboardPlus className="h-4 w-4" />{t("drug-master.reviewBeforeSaving")}</Button>
            </div>
          </form>
        </section>

        <section className="min-h-[360px] rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600"><History className="h-5 w-5" /></span><div><h2 className="font-black text-slate-950">{t("common.drugAllergyHistory")}</h2><p className="text-xs font-semibold text-slate-500">{t("drug-master.readOnlyExistingRecordsCannotBeEdited")}</p></div></div>
          {!selectedPatient ? <EmptyHistory text={t("drug-master.selectAPatientToViewAllergyHistory")} /> : historyLoading ? <div className="flex min-h-64 items-center justify-center gap-2 font-bold text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />{t("drug-master.loadingHistory")}</div> : history?.ITEMS.length ? (
            <div className="mt-5 space-y-3">
              {history.ITEMS.map((item, index) => (
                <article className="rounded-2xl border border-red-100 bg-red-50/40 p-4" key={`${item.RECORD_KEY}-${index}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2"><div><div className="font-black text-slate-950">{item.COMMERCIALNAME || item.GENERICNAME || item.MEDICINECODE}</div><div className="mt-1 font-mono text-xs font-bold text-slate-500">{item.MEDICINECODE}</div></div><span className="rounded-full border border-red-200 bg-white px-2.5 py-1 text-xs font-black text-red-700">{t("drug-master.ai")}</span></div>
                  <dl className="mt-3 grid gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
                    <HistoryDetail label={t("common.allergicSymptoms")} value={item.SIDE_EFFECT} />
                    <HistoryDetail label={t("common.severity")} value={item.SEVERITY} />
                    <HistoryDetail label={t("common.type")} value={item.ALLERGY_TYPE} />
                    <HistoryDetail label={t("drug-master.correlation")} value={item.CORRELATION_LEVEL} />
                    <HistoryDetail label={t("drug-master.detailsThai")} value={item.ADVERSE_REACTION_LOCAL} />
                    <HistoryDetail label={t("drug-master.detailsEnglish")} value={item.ADVERSE_REACTION_ENGLISH} />
                    <HistoryDetail label={t("drug-master.certifiedBy2")} value={item.CERTIFIED_BY} />
                    <HistoryDetail label={t("common.notes")} value={item.REMARKS} />
                    <HistoryDetail label={t("drug-master.recordedOn")} value={formatDateTime(item.CREATEDATETIME)} />
                  </dl>
                </article>
              ))}
            </div>
          ) : <EmptyHistory text={t("drug-master.noDrugAllergyHistoryForThisPatient")} />}
        </section>
      </div>

      {confirming && selectedPatient && selectedMedicine ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 p-4" role="presentation">
          <section aria-labelledby="confirm-allergy-title" aria-modal="true" className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl" role="dialog">
            <div className="mb-3 flex justify-end"><LanguageSwitcher /></div>
            <div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-600"><AlertTriangle className="h-5 w-5" /></span><div><h2 className="text-lg font-black text-slate-950" id="confirm-allergy-title">{t("drug-master.confirmDrugAllergyRecord")}</h2><p className="mt-1 text-sm font-semibold text-slate-500">{t("drug-master.thisRecordWillCreateAnAiAlert")}</p></div></div>
            <div className="mt-5 space-y-3 rounded-2xl bg-slate-50 p-4 text-sm">
              <ConfirmRow label={t("drug-master.patient")} value={`${selectedPatient.FULLNAME_TH ?? t("drug-master.nameUnspecified")} · HN ${selectedPatient.PATIENTID}`} />
              <ConfirmRow label={t("drug-master.medication")} value={medicineLabel(selectedMedicine, t)} />
              <ConfirmRow label={t("common.allergicSymptoms")} value={form.sideEffect} />
              <ConfirmRow label={t("common.severity")} value={form.severity} />
              <ConfirmRow label={t("drug-master.certifiedBy2")} value={form.certifiedBy} />
            </div>
            <div className="mt-6 flex justify-end gap-2"><Button disabled={saving} onClick={() => setConfirming(false)} variant="outline">{t("drug-master.back")}</Button><Button disabled={saving} onClick={() => void save()}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardPlus className="h-4 w-4" />}{t("drug-master.confirmSave")}</Button></div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function FieldTitle({ children, required = false }: { children: React.ReactNode; required?: boolean }) {
  return <div className="text-sm font-black text-slate-700">{children}{required ? <span className="ml-1 text-red-500">*</span> : null}</div>;
}

function FormField({ children, label, required = false }: { children: React.ReactNode; label: string; required?: boolean }) {
  return <label className="block text-sm font-black text-slate-700">{label}{required ? <span className="ml-1 text-red-500">*</span> : null}<div className="mt-1.5 [&_input]:font-semibold [&_textarea]:min-h-24 [&_textarea]:w-full [&_textarea]:rounded-xl [&_textarea]:border [&_textarea]:border-slate-300 [&_textarea]:p-3 [&_textarea]:text-sm [&_textarea]:font-semibold [&_textarea]:outline-none [&_textarea]:transition [&_textarea:focus]:border-blue-500 [&_textarea:focus]:ring-2 [&_textarea:focus]:ring-blue-100">{children}</div></label>;
}

function EmptyHistory({ text }: { text: string }) {
  return <div className="mt-5 flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-6 text-center"><History className="h-8 w-8 text-slate-300" /><p className="mt-3 text-sm font-bold text-slate-500">{text}</p></div>;
}

function HistoryDetail({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return <div><dt className="font-black text-slate-500">{label}</dt><dd className="mt-0.5 whitespace-pre-wrap font-semibold leading-5 text-slate-800">{value}</dd></div>;
}

function ConfirmRow({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs font-black text-slate-500">{label}</div><div className="mt-0.5 font-bold text-slate-900">{value}</div></div>;
}

function updateForm<K extends keyof AllergyForm>(setter: React.Dispatch<React.SetStateAction<AllergyForm>>, key: K, value: AllergyForm[K]) {
  setter((current) => ({ ...current, [key]: value }));
}

function medicineLabel(medicine: DrugAllergyMedicine, t: Translator) {
  const name = medicine.COMMERCIALNAME || medicine.LOCALNAME || medicine.GENERICNAME || t("drug-master.medicationNameUnspecified");
  return `${medicine.MEDICINECODE} — ${name}`;
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

function readError(reason: unknown) {
  if (reason instanceof ApiClientError) {
    if (reason.status === 409) return uiMessage("drug-master.thisDrugAllergyRecordAlreadyExists");
    return frontendErrorMessage(reason, uiMessage("drug-master.anErrorOccurredTryAgain"));
  }
  return frontendErrorMessage(reason, uiMessage("drug-master.anErrorOccurredTryAgain"));
}
