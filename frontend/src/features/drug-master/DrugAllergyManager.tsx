"use client";

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
import { toast } from "sonner";
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
      if (result.length === 0) toast.info("ไม่พบผู้ป่วยจากคำค้นนี้");
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
      if (result.length === 0) toast.info("ไม่พบยาจากคำค้นนี้");
    } catch (reason) {
      toast.error(readError(reason));
    } finally {
      setMedicineSearching(false);
    }
  }

  function requestConfirmation(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) {
      toast.error("กรุณากรอกข้อมูลที่จำเป็นให้ครบและเลือกผู้ป่วยกับยาจากผลการค้นหา");
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
      toast.success("บันทึกข้อมูลแพ้ยาแล้ว คำเตือน AI จะอัปเดตผ่านระบบ Realtime");
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
              <h1 className="text-xl font-black text-slate-950">เพิ่มข้อมูลแพ้ยาผู้ป่วย</h1>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">ข้อมูลจะบันทึกลงทะเบียนแพ้ยาและแสดง AI เมื่อผู้ป่วยได้รับยารหัสเดียวกัน</p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <FieldTitle required>ค้นหาผู้ป่วย</FieldTitle>
            <form className="mt-2 flex gap-2" onSubmit={findPatients}>
              <Input maxLength={100} onChange={(event) => { setPatientQuery(event.target.value); if (selectedPatient) clearSelectedPatient(); }} placeholder="กรอก HN หรือชื่อผู้ป่วย" value={patientQuery} />
              <Button disabled={patientSearching || !patientQuery.trim()} type="submit">
                {patientSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}ค้นหา
              </Button>
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
                    <span><span className="block text-sm font-black text-slate-900">{patient.FULLNAME_TH ?? "ไม่ระบุชื่อผู้ป่วย"}</span><span className="mt-0.5 block font-mono text-xs font-bold text-slate-500">HN {patient.PATIENTID}</span></span>
                    <CheckCircle2 className="h-5 w-5 text-blue-600" />
                  </button>
                ))}
              </div>
            ) : null}
            {selectedPatient ? (
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                <UserRound className="h-5 w-5 text-blue-600" />
                <div className="min-w-0 flex-1"><div className="truncate font-black text-slate-900">{selectedPatient.FULLNAME_TH ?? "ไม่ระบุชื่อผู้ป่วย"}</div><div className="font-mono text-xs font-bold text-blue-700">HN {selectedPatient.PATIENTID}</div></div>
                <button aria-label="เปลี่ยนผู้ป่วย" className="rounded-lg p-1.5 text-slate-500 hover:bg-white" onClick={() => { clearSelectedPatient(); setPatientQuery(""); }} type="button"><X className="h-4 w-4" /></button>
              </div>
            ) : null}
          </div>

          <form className="mt-5 space-y-5" onSubmit={requestConfirmation}>
            <div>
              <FieldTitle required>ยาที่ผู้ป่วยแพ้</FieldTitle>
              <div className="mt-2 flex gap-2">
                <Input disabled={!selectedPatient} maxLength={100} onChange={(event) => { setMedicineQuery(event.target.value); setSelectedMedicine(null); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void findMedicines(); } }} placeholder="ค้นหารหัสยา ชื่อการค้า หรือชื่อสามัญ" value={medicineQuery} />
                <Button disabled={!selectedPatient || medicineSearching || !medicineQuery.trim()} onClick={() => void findMedicines()} type="button" variant="outline">
                  {medicineSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}ค้นยา
                </Button>
              </div>
              {medicineResults.length > 0 ? (
                <div className="mt-2 max-h-56 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
                  {medicineResults.map((medicine) => (
                    <button className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left hover:border-blue-400 hover:bg-blue-50" key={medicine.MEDICINECODE} onClick={() => { setSelectedMedicine(medicine); setMedicineQuery(medicineLabel(medicine)); setMedicineResults([]); }} type="button">
                      <span className="block text-sm font-black text-slate-900">{medicine.COMMERCIALNAME || medicine.LOCALNAME || medicine.GENERICNAME || medicine.MEDICINECODE}</span>
                      <span className="mt-1 block font-mono text-xs font-bold text-slate-500">{medicine.MEDICINECODE}{medicine.STRENGTH ? ` · ${medicine.STRENGTH}` : ""}</span>
                    </button>
                  ))}
                </div>
              ) : null}
              {selectedMedicine ? <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">เลือกแล้ว: {medicineLabel(selectedMedicine)}</div> : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="อาการแพ้ / Side effect" required><textarea maxLength={1000} onChange={(event) => updateForm(setForm, "sideEffect", event.target.value)} placeholder="เช่น ผื่นคัน หายใจติดขัด" value={form.sideEffect} /></FormField>
              <FormField label="ประเภทการแพ้" required><Input list="allergy-types" maxLength={100} onChange={(event) => updateForm(setForm, "allergyType", event.target.value)} value={form.allergyType} /><datalist id="allergy-types"><option value="Drug Allergy" /><option value="Drug Intolerance" /></datalist></FormField>
              <FormField label="ความรุนแรง" required><Input list="allergy-severity" maxLength={100} onChange={(event) => updateForm(setForm, "severity", event.target.value)} placeholder="เลือกหรือกรอกระดับความรุนแรง" value={form.severity} /><datalist id="allergy-severity">{severitySuggestions.map((item) => <option key={item} value={item} />)}</datalist></FormField>
              <FormField label="Correlation level" required><Input list="allergy-correlation" maxLength={100} onChange={(event) => updateForm(setForm, "correlationLevel", event.target.value)} placeholder="เลือกหรือกรอกความสัมพันธ์" value={form.correlationLevel} /><datalist id="allergy-correlation">{correlationSuggestions.map((item) => <option key={item} value={item} />)}</datalist></FormField>
              <FormField label="รายละเอียดอาการ (ไทย)"><textarea maxLength={2000} onChange={(event) => updateForm(setForm, "adverseReactionLocal", event.target.value)} value={form.adverseReactionLocal} /></FormField>
              <FormField label="รายละเอียดอาการ (English)"><textarea maxLength={2000} onChange={(event) => updateForm(setForm, "adverseReactionEnglish", event.target.value)} value={form.adverseReactionEnglish} /></FormField>
              <FormField label="ผู้รับรองข้อมูล" required><Input maxLength={150} onChange={(event) => updateForm(setForm, "certifiedBy", event.target.value)} placeholder="ชื่อเภสัชกรหรือผู้บันทึก" value={form.certifiedBy} /></FormField>
              <FormField label="หมายเหตุ"><textarea maxLength={4000} onChange={(event) => updateForm(setForm, "remarks", event.target.value)} value={form.remarks} /></FormField>
            </div>

            <div className="flex justify-end border-t border-slate-200 pt-5">
              <Button className="h-11 px-5" disabled={!canSubmit || saving} type="submit"><ClipboardPlus className="h-4 w-4" />ตรวจสอบก่อนบันทึก</Button>
            </div>
          </form>
        </section>

        <section className="min-h-[360px] rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600"><History className="h-5 w-5" /></span><div><h2 className="font-black text-slate-950">ประวัติแพ้ยา</h2><p className="text-xs font-semibold text-slate-500">อ่านอย่างเดียว ไม่แก้ไขหรือลบข้อมูลเดิม</p></div></div>
          {!selectedPatient ? <EmptyHistory text="เลือกผู้ป่วยเพื่อดูประวัติแพ้ยา" /> : historyLoading ? <div className="flex min-h-64 items-center justify-center gap-2 font-bold text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />กำลังโหลดประวัติ...</div> : history?.ITEMS.length ? (
            <div className="mt-5 space-y-3">
              {history.ITEMS.map((item, index) => (
                <article className="rounded-2xl border border-red-100 bg-red-50/40 p-4" key={`${item.RECORD_KEY}-${index}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2"><div><div className="font-black text-slate-950">{item.COMMERCIALNAME || item.GENERICNAME || item.MEDICINECODE}</div><div className="mt-1 font-mono text-xs font-bold text-slate-500">{item.MEDICINECODE}</div></div><span className="rounded-full border border-red-200 bg-white px-2.5 py-1 text-xs font-black text-red-700">AI</span></div>
                  <dl className="mt-3 grid gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
                    <HistoryDetail label="อาการแพ้" value={item.SIDE_EFFECT} />
                    <HistoryDetail label="ความรุนแรง" value={item.SEVERITY} />
                    <HistoryDetail label="ประเภท" value={item.ALLERGY_TYPE} />
                    <HistoryDetail label="Correlation" value={item.CORRELATION_LEVEL} />
                    <HistoryDetail label="รายละเอียด (ไทย)" value={item.ADVERSE_REACTION_LOCAL} />
                    <HistoryDetail label="รายละเอียด (English)" value={item.ADVERSE_REACTION_ENGLISH} />
                    <HistoryDetail label="ผู้รับรอง" value={item.CERTIFIED_BY} />
                    <HistoryDetail label="หมายเหตุ" value={item.REMARKS} />
                    <HistoryDetail label="วันที่บันทึก" value={formatDateTime(item.CREATEDATETIME)} />
                  </dl>
                </article>
              ))}
            </div>
          ) : <EmptyHistory text="ยังไม่พบประวัติแพ้ยาของผู้ป่วยรายนี้" />}
        </section>
      </div>

      {confirming && selectedPatient && selectedMedicine ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 p-4" role="presentation">
          <section aria-labelledby="confirm-allergy-title" aria-modal="true" className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl" role="dialog">
            <div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-600"><AlertTriangle className="h-5 w-5" /></span><div><h2 className="text-lg font-black text-slate-950" id="confirm-allergy-title">ยืนยันการบันทึกข้อมูลแพ้ยา</h2><p className="mt-1 text-sm font-semibold text-slate-500">ข้อมูลนี้จะทำให้ระบบแสดงคำเตือน AI ในใบสั่งยาที่ตรงกัน</p></div></div>
            <div className="mt-5 space-y-3 rounded-2xl bg-slate-50 p-4 text-sm">
              <ConfirmRow label="ผู้ป่วย" value={`${selectedPatient.FULLNAME_TH ?? "ไม่ระบุชื่อ"} · HN ${selectedPatient.PATIENTID}`} />
              <ConfirmRow label="ยา" value={medicineLabel(selectedMedicine)} />
              <ConfirmRow label="อาการแพ้" value={form.sideEffect} />
              <ConfirmRow label="ความรุนแรง" value={form.severity} />
              <ConfirmRow label="ผู้รับรอง" value={form.certifiedBy} />
            </div>
            <div className="mt-6 flex justify-end gap-2"><Button disabled={saving} onClick={() => setConfirming(false)} variant="outline">ย้อนกลับ</Button><Button disabled={saving} onClick={() => void save()}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardPlus className="h-4 w-4" />}ยืนยันบันทึก</Button></div>
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

function medicineLabel(medicine: DrugAllergyMedicine) {
  const name = medicine.COMMERCIALNAME || medicine.LOCALNAME || medicine.GENERICNAME || "ไม่ระบุชื่อยา";
  return `${medicine.MEDICINECODE} — ${name}`;
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

function readError(reason: unknown) {
  if (reason instanceof ApiClientError) {
    if (reason.status === 409) return "พบข้อมูลแพ้ยารายการเดียวกันอยู่แล้ว";
    if (reason.status === 422) return reason.message.replace("exceeds the TBLALLERGY limit of", "ยาวเกินขนาดที่ฐานข้อมูลรองรับ");
    return reason.message;
  }
  return reason instanceof Error ? reason.message : "เกิดข้อผิดพลาด กรุณาลองใหม่";
}
