"use client";

import { AlertTriangle, CheckCircle2, ClipboardCheck, FileText, Pill, Printer, RefreshCw, Search, ShieldAlert, Stethoscope, UserRound, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getPatientProfile } from "@/lib/patient-profile-api";
import { getMachineStockCheck } from "@/lib/stock-check-api";
import { cn } from "@/lib/utils";
import type { AlertKind, PatientLabResult, PatientProfile, PatientQueueItem } from "@/types/pharmacy";
import { PatientProfilePopup } from "@/features/patient-profile/PatientProfilePopup";
import { stageDotStyles, stageLabel, stageStyles } from "@/features/queue/queue-ui";
import { MachineStockCheck } from "./MachineStockCheck";

const alertTone: Record<AlertKind, { label: string; className: string }> = {
  duplicate: { label: "Duplicate", className: "border-violet-200 bg-violet-50 text-violet-700" },
  interaction: { label: "DI", className: "border-rose-200 bg-rose-50 text-rose-700" },
  machine: { label: "Machine", className: "border-blue-200 bg-blue-50 text-blue-700" },
  stock: { label: "Stock", className: "border-amber-200 bg-amber-50 text-amber-700" },
  paper: { label: "Paper", className: "border-yellow-200 bg-yellow-50 text-yellow-700" },
  note: { label: "Note", className: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700" },
};

const hadChecklistItems = [
  { id: "dose", label: "ตรวจสอบขนาดยา (dose) ตามน้ำหนัก/ไต" },
  { id: "strength", label: "ยืนยันความเข้มข้น / รูปแบบยา" },
  { id: "double-check", label: "Double-check โดยเภสัชกรท่านที่ 2" },
  { id: "red-label", label: "ติดฉลาก High-Alert สีแดง" },
] as const;

type HadChecklistItemId = (typeof hadChecklistItems)[number]["id"];

const medicationErrorCategories = [
  {
    id: "prescribing",
    label: "Prescribing error",
    options: [
      { id: "wrong-drug", label: "สั่งยาผิดชนิด" },
      { id: "wrong-quantity", label: "สั่งยาผิดจำนวน" },
      { id: "wrong-strength", label: "สั่งยาผิดความแรง" },
      { id: "dosage-too-low", label: "สั่งยาขนาดต่ำเกินไป (dosage too low)" },
      { id: "dosage-too-high", label: "สั่งยาขนาดสูงเกินไป (dosage too high)" },
      { id: "wrong-administration", label: "วิธีรับประทานยา/บริหารยาผิด" },
      { id: "drug-interaction", label: "สั่งยาที่มี Drug interaction" },
      { id: "duplicate-drug", label: "สั่งยาซ้ำซ้อน" },
      { id: "omitted-drug", label: "ไม่ได้สั่งยา/สั่งยาไม่ครบ" },
      { id: "allergy-risk", label: "สั่งยาที่มีโอกาสแพ้ยา" },
      { id: "no-condition-adjustment", label: "ไม่ได้ปรับขนาดยาตามสภาวะผู้ป่วย" },
      { id: "discontinued-drug", label: "สั่งยาที่มีการหยุดใช้ไปแล้ว" },
      { id: "contraindicated-drug", label: "สั่งยาที่มีข้อห้ามใช้" },
    ],
  },
  {
    id: "pre-dispensing",
    label: "Pre-dispensing error",
    options: [
      { id: "wrong-drug", label: "จัดยาผิดชนิด" },
      { id: "wrong-quantity", label: "จัดยาผิดจำนวน" },
      { id: "wrong-strength", label: "จัดยาผิดความแรง" },
      { id: "omitted-drug", label: "ไม่ได้จัดยา/จัดยาไม่ครบรายการ" },
      { id: "mixed-drug", label: "จัดยาปะปนกัน" },
      { id: "wrong-label", label: "แปะฉลากยาผิด" },
      { id: "wrong-patient", label: "จัดยาผิดคน" },
    ],
  },
  {
    id: "dispensing",
    label: "Dispensing error",
    options: [
      { id: "wrong-patient", label: "จ่ายยาผิดคน" },
      { id: "wrong-drug", label: "จ่ายยาผิดชนิด" },
      { id: "wrong-quantity", label: "จ่ายยาผิดจำนวน" },
      { id: "wrong-strength", label: "จ่ายยาผิดความแรง" },
      { id: "omitted-drug", label: "จ่ายยาไม่ครบรายการ" },
      { id: "mixed-drug", label: "จ่ายยาปะปนกัน" },
      { id: "wrong-label", label: "จ่ายยาที่ติดฉลากผิด" },
      { id: "wrong-patient-confirmation", label: "จ่ายยาผิดคน" },
    ],
  },
] as const;

type MedicationErrorCategoryId = (typeof medicationErrorCategories)[number]["id"];

const medicationErrorSeverities = [
  { key: "A", th: "มีโอกาส/สถานการณ์ที่อาจก่อให้เกิดความคลาดเคลื่อน", category: "No Error", color: "#94a3b8" },
  { key: "B", th: "เกิดความคลาดเคลื่อน แต่ยังไม่ถึงผู้ป่วย", category: "No Harm", color: "#16a34a" },
  { key: "C", th: "ถึงผู้ป่วยแล้ว แต่ไม่เป็นอันตราย", category: "No Harm", color: "#3f9d5c" },
  { key: "D", th: "ถึงผู้ป่วย ต้องเฝ้าระวังเพื่อยืนยันว่าไม่เป็นอันตราย", category: "No Harm", color: "#5cab73" },
  { key: "E", th: "เกิดอันตรายชั่วคราว ต้องได้รับการบำบัดรักษา", category: "Harm", color: "#e0a008" },
  { key: "F", th: "เกิดอันตรายชั่วคราว ต้องนอน รพ. หรือนานขึ้น", category: "Harm", color: "#e07d12" },
  { key: "G", th: "เกิดอันตรายถาวรแก่ผู้ป่วย", category: "Harm", color: "#d83a3a" },
  { key: "H", th: "เกิดอันตราย ต้องได้รับการช่วยชีวิต", category: "Harm", color: "#c11f3a" },
  { key: "I", th: "เป็นเหตุให้ผู้ป่วยเสียชีวิต", category: "Death", color: "#7a1020" },
] as const;

type MedicationErrorSeverityKey = (typeof medicationErrorSeverities)[number]["key"];

export function PatientPanel({ patient, pn, onClose }: { patient: PatientQueueItem; pn?: string; onClose: () => void }) {
  const [hasRequestedStockCheck, setHasRequestedStockCheck] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isHadOpen, setIsHadOpen] = useState(false);
  const [isMedicationErrorOpen, setIsMedicationErrorOpen] = useState(false);
  const [hadChecklist, setHadChecklist] = useState<Partial<Record<HadChecklistItemId, boolean>>>({});
  const [medicationErrorCategory, setMedicationErrorCategory] = useState<MedicationErrorCategoryId | null>(null);
  const [medicationErrorSubtype, setMedicationErrorSubtype] = useState<string | null>(null);
  const [medicationErrorSeverity, setMedicationErrorSeverity] = useState<MedicationErrorSeverityKey | null>(null);
  const [medicationErrorDescription, setMedicationErrorDescription] = useState("");
  const [note, setNote] = useState("");

  const { data: profile } = useQuery({
    queryKey: ["patient-profile-inline", patient.id],
    queryFn: () => getPatientProfile(patient),
  });
  const { data: stockCheck, isFetching: isCheckingStock } = useQuery({
    queryKey: ["machine-stock-check", patient.id, pn],
    queryFn: () => getMachineStockCheck(patient),
    enabled: hasRequestedStockCheck,
  });

  const displayProfile = useMemo(() => buildInlineProfile(patient, profile), [patient, profile]);
  const headerLabs = useMemo(() => buildHeaderLabs(patient.id, displayProfile.labs), [displayProfile.labs, patient.id]);
  const bmi = calculateBmi(displayProfile.weight, displayProfile.height);
  const completedHadCount = hadChecklistItems.filter((item) => hadChecklist[item.id]).length;

  function requestStockCheck() {
    setHasRequestedStockCheck(true);
  }

  function toggleHadChecklistItem(id: HadChecklistItemId) {
    setHadChecklist((current) => ({ ...current, [id]: !current[id] }));
  }

  return (
    <div className="fixed inset-0 z-50 flex h-dvh justify-end bg-[#0f1f3d]/35">
      <button aria-label="ปิดแผงข้อมูลผู้ป่วย" className="hidden flex-1 cursor-default lg:block" onClick={onClose} type="button" />
      <div className="flex h-full w-full justify-end gap-3 p-0 lg:w-auto lg:p-3">
        {isProfileOpen ? <PatientProfilePopup patient={patient} onClose={() => setIsProfileOpen(false)} /> : null}

        <aside className="flex h-full w-full flex-col overflow-hidden bg-[#f6f8fb] shadow-[-18px_0_50px_rgba(15,31,61,0.22)] sm:max-w-[94vw] lg:w-[760px] lg:rounded-2xl lg:border lg:border-slate-200">
          <header className="shrink-0 border-b border-slate-200 bg-white px-5 py-4 sm:px-7">
            <div className="flex items-start gap-3 sm:gap-4">
              <Button aria-label="ปิด" className="h-10 w-10 shrink-0 rounded-xl border-slate-200" onClick={onClose} size="icon" variant="outline">
                <X className="h-5 w-5" />
              </Button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-2xl font-black text-slate-950">{displayProfile.fullName}</h2>
                  <Badge className={stageStyles[patient.stage]}>
                    <span className={cn("mr-2 h-2 w-2 rounded-full", stageDotStyles[patient.stage])} />
                    {stageLabel(patient.stage)}
                  </Badge>
                  <Badge className={priorityClassName(patient.priority)}>{patient.priority}</Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-bold text-slate-500">
                  <span>VN {displayProfile.vn}</span>
                  <span>HN {displayProfile.hn}</span>
                  {pn ? <span className="rounded-md bg-blue-50 px-2 py-0.5 font-mono text-blue-700">PN {pn}</span> : null}
                  <span>{displayProfile.sex} · {displayProfile.age}</span>
                </div>
              </div>
              <Button
                aria-label="เปิด Subjective"
                className="h-10 w-10 shrink-0 rounded-xl sm:w-auto sm:px-3"
                onClick={() => setIsProfileOpen(true)}
                size="icon"
                title="Subjective"
                variant="secondary"
              >
                <UserRound className="h-4 w-4" />
                <span className="hidden sm:inline">Subjective</span>
              </Button>
            </div>

            <div className="mt-4 overflow-x-auto pb-1">
              <div className="flex min-w-max items-stretch gap-2">
                <div className="min-w-[230px] rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 shadow-sm">
                  <div className="text-[10px] font-black uppercase tracking-[0.12em] text-blue-500">น้ำหนัก / ส่วนสูง / BMI</div>
                  <div className="mt-1 text-sm font-black text-blue-900">
                    {displayProfile.weight} · {displayProfile.height} · BMI {bmi}
                  </div>
                </div>
                {headerLabs.map((lab) => (
                  <LabChip key={lab.id} lab={lab} />
                ))}
              </div>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
            <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-900 shadow-sm">
              <div className="flex gap-3">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
                <div>
                  <div className="text-lg font-black">แพ้ยา / ADR</div>
                  <p className="mt-1 text-sm font-semibold leading-6 text-rose-800">{displayProfile.allergy}</p>
                </div>
              </div>
            </section>

            <section className="mt-5 grid gap-3 sm:grid-cols-2">
              <InfoCard icon={<Stethoscope className="h-4 w-4" />} label="Ward / Clinic" value={displayProfile.ward} />
              <InfoCard icon={<FileText className="h-4 w-4" />} label="Diagnosis" value={displayProfile.diagnosis} />
              <InfoCard icon={<UserRound className="h-4 w-4" />} label="แพทย์ผู้ดูแล" value={displayProfile.doctor} />
              <InfoCard label="Renal / DI" value={`${displayProfile.renal} · ${displayProfile.drugInteraction}`} />
            </section>

            <section className="mt-6">
              <div className="mb-3">
                <h3 className="text-sm font-black text-slate-500">รายการยา ({patient.drugs.length})</h3>
                <p className="mt-1 text-xs font-bold text-slate-400">ตรวจสอบคำสั่งใช้ยา แหล่งจ่าย และ alert สำคัญก่อนส่งต่อ</p>
              </div>

              <div className="space-y-3">
                {patient.drugs.map((drug) => {
                  const dose = splitDrugSig(drug.sig);

                  return (
                    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" key={drug.id}>
                      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                        <div className="flex min-w-0 gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                            <Pill className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-lg font-black text-slate-950">{drug.name}</h4>
                            </div>
                            <p className="mt-1 text-sm font-semibold text-slate-500">{dose.instruction}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {patient.alerts.length > 0 ? (
                                patient.alerts.slice(0, 3).map((alert) => (
                                  <span className={cn("rounded-full border px-2.5 py-1 text-xs font-black", alertTone[alert].className)} key={alert}>
                                    {alertTone[alert].label}
                                  </span>
                                ))
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  ผ่านการตรวจสอบ
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-end justify-between gap-5 sm:block sm:text-right">
                          <div>
                            <div className="text-sm font-black text-indigo-500">{drug.source}</div>
                            <div className="mt-1 text-xs font-bold text-slate-400">{drug.machineCode}</div>
                          </div>
                          <div className="mt-2 text-base font-black text-slate-900">{dose.quantity}</div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="mt-6">
              <label className="text-sm font-black text-slate-500" htmlFor="verify-note">บันทึก / NOTE ถึงจุด Dispensing</label>
              <textarea
                className="mt-2 min-h-24 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                id="verify-note"
                onChange={(event) => setNote(event.target.value)}
                placeholder="พิมพ์บันทึกเพิ่มเติม..."
                value={note}
              />
            </section>

            <section className="mt-6">
              <div className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-[0.12em] text-slate-400">
                <AlertTriangle className="h-4 w-4" />
                Issues Detected
              </div>
              <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-violet-900 shadow-sm">
                <div className="flex items-start gap-3">
                  <Pill className="mt-1 h-4 w-4 text-violet-600" />
                  <div>
                    <div className="font-black">{patient.issue?.title ?? "No Critical Issue"}</div>
                    <div className="mt-2 text-sm font-medium text-violet-800">{patient.issue?.detail ?? "ยังไม่พบ alert สำคัญในรายการนี้"}</div>
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-6">
              <Button className="h-14 w-full border-dashed border-blue-200 text-blue-700" disabled={isCheckingStock} onClick={requestStockCheck} variant="outline">
                <Search className="h-5 w-5" />
                {isCheckingStock ? "กำลังตรวจสอบเครื่องและสต็อก" : "ตรวจสอบเครื่องและสต็อก"}
              </Button>
              {hasRequestedStockCheck ? <MachineStockCheck stockCheck={stockCheck} isLoading={isCheckingStock} /> : null}
            </section>
          </div>

          <footer className="safe-bottom shrink-0 border-t border-slate-200 bg-white px-5 py-4 sm:px-7">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <Button className="h-11 rounded-xl border-slate-200" onClick={() => setIsHadOpen(true)} variant="outline">
                <ClipboardCheck className="h-4 w-4" />
                <span className={cn("h-2.5 w-2.5 rounded-full", completedHadCount > 0 ? "bg-emerald-500" : "bg-slate-300")} />
                HAD Checklist
              </Button>
              <Button className="h-11 rounded-xl border-slate-200" variant="outline">
                <Printer className="h-4 w-4" />
                พิมพ์ใบ NED
              </Button>
              <Button className="h-11 rounded-xl border-orange-200 text-orange-700 hover:bg-orange-50" onClick={() => setIsMedicationErrorOpen(true)} variant="outline">
                <RefreshCw className="h-4 w-4" />
                รายงาน ME
              </Button>
              <Button className="h-11 rounded-xl bg-blue-600 text-white hover:bg-blue-700">
                <CheckCircle2 className="h-4 w-4" />
                Verify & ส่ง MDR
              </Button>
            </div>
          </footer>
        </aside>
      </div>

      {isHadOpen ? (
        <HadChecklistModal
          checkedItems={hadChecklist}
          completedCount={completedHadCount}
          onClose={() => setIsHadOpen(false)}
          onToggle={toggleHadChecklistItem}
        />
      ) : null}

      {isMedicationErrorOpen ? (
        <MedicationErrorReportModal
          category={medicationErrorCategory}
          description={medicationErrorDescription}
          onCategoryChange={(category) => {
            setMedicationErrorCategory(category);
            setMedicationErrorSubtype(null);
            setMedicationErrorSeverity(null);
          }}
          onClose={() => setIsMedicationErrorOpen(false)}
          onDescriptionChange={setMedicationErrorDescription}
          onSave={() => setIsMedicationErrorOpen(false)}
          onSeverityChange={setMedicationErrorSeverity}
          selectedSeverity={medicationErrorSeverity}
          subtype={medicationErrorSubtype}
          onSubtypeChange={(subtype) => {
            setMedicationErrorSubtype(subtype);
            setMedicationErrorSeverity("B");
          }}
        />
      ) : null}
    </div>
  );
}

function buildInlineProfile(patient: PatientQueueItem, profile?: PatientProfile) {
  return {
    hn: profile?.hn ?? patient.hn,
    vn: profile?.vn ?? patient.vn,
    fullName: profile?.fullName ?? patient.name,
    age: profile?.age ?? "ไม่ระบุอายุ",
    sex: profile?.sex ?? "ไม่ระบุเพศ",
    weight: profile?.weight ?? "ไม่ระบุ",
    height: profile?.height ?? "ไม่ระบุ",
    ward: profile?.ward ?? "OPD",
    doctor: profile?.doctor ?? patient.pharmacist ?? "รอข้อมูลแพทย์",
    diagnosis: profile?.diagnosis ?? "รอข้อมูลวินิจฉัย",
    allergy: profile?.keyHistory.allergy ?? patient.issue?.detail ?? "ไม่มีประวัติแพ้ยา",
    renal: profile?.keyHistory.renal ?? "รอข้อมูล",
    drugInteraction: profile?.keyHistory.drugInteraction ?? "รอข้อมูล",
    labs: profile?.labs && profile.labs.length > 0 ? profile.labs : fallbackLabs(patient),
  };
}

function fallbackLabs(patient: PatientQueueItem): PatientLabResult[] {
  const hasCriticalAlert = patient.alerts.includes("stock") || patient.alerts.includes("interaction");

  return [
    { id: `${patient.id}-fallback-egfr`, key: "eGFR", value: hasCriticalAlert ? "48" : "74", unit: "mL/min", high: hasCriticalAlert },
    { id: `${patient.id}-fallback-scr`, key: "Scr", value: hasCriticalAlert ? "1.6" : "0.9", unit: "mg/dL", high: hasCriticalAlert },
    { id: `${patient.id}-fallback-k`, key: "K+", value: "4.2", unit: "mmol/L" },
    { id: `${patient.id}-fallback-alt`, key: "ALT", value: "28", unit: "U/L" },
  ];
}

const headerLabDefaults = [
  { key: "EGFR", value: "74", unit: "mL/min" },
  { key: "SCR", value: "0.9", unit: "mg/dL" },
  { key: "BPSYS", value: "128", unit: "mmHg" },
  { key: "BPDIAS", value: "78", unit: "mmHg" },
  { key: "TEMP", value: "36.7", unit: "°C" },
  { key: "PULSERATE", value: "76", unit: "bpm" },
  { key: "RESPIRA", value: "18", unit: "/min" },
  { key: "O2SAT", value: "98", unit: "%" },
] as const;

function buildHeaderLabs(patientId: string, labs: PatientLabResult[]): PatientLabResult[] {
  return headerLabDefaults.map((defaultLab) => {
    const existingLab = labs.find((lab) => normalizeLabKey(lab.key) === defaultLab.key);

    return existingLab
      ? { ...existingLab, key: defaultLab.key }
      : {
          id: `${patientId}-header-${defaultLab.key.toLowerCase()}`,
          key: defaultLab.key,
          value: defaultLab.value,
          unit: defaultLab.unit,
        };
  });
}

function normalizeLabKey(key: string) {
  return key.replace(/[^a-z0-9]/gi, "").toUpperCase();
}

function calculateBmi(weight: string, height: string) {
  const weightKg = Number.parseFloat(weight);
  const heightCm = Number.parseFloat(height);

  if (!Number.isFinite(weightKg) || !Number.isFinite(heightCm) || heightCm <= 0) {
    return "ไม่ระบุ";
  }

  return (weightKg / ((heightCm / 100) ** 2)).toFixed(1);
}

function LabChip({ lab }: { lab: PatientLabResult }) {
  return (
    <div className="min-w-[86px] rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{lab.key}</div>
      <div className={cn("mt-1 font-mono text-lg font-black text-slate-900", lab.high && "text-rose-600")}>
        {lab.value}
        {lab.unit ? <span className="ml-1 text-[11px] font-bold text-slate-400">{lab.unit}</span> : null}
      </div>
    </div>
  );
}

function InfoCard({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.08em] text-slate-400">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-sm font-black text-slate-800">{value}</div>
    </div>
  );
}

function splitDrugSig(sig: string) {
  const [instruction, quantity] = sig.split("·").map((part) => part.trim());

  return {
    instruction: instruction || sig,
    quantity: quantity || "-",
  };
}

function priorityClassName(priority: PatientQueueItem["priority"]) {
  if (priority === "Stat") return "bg-rose-100 text-rose-700";
  if (priority === "Re-work") return "bg-orange-100 text-orange-700";
  return "bg-slate-100 text-slate-500";
}

function HadChecklistModal({
  checkedItems,
  completedCount,
  onClose,
  onToggle,
}: {
  checkedItems: Partial<Record<HadChecklistItemId, boolean>>;
  completedCount: number;
  onClose: () => void;
  onToggle: (id: HadChecklistItemId) => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#0f1f3d]/45 p-4" onClick={onClose}>
      <section className="w-full max-w-[480px] overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(15,31,61,0.32)]" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-center gap-3 border-b border-slate-100 px-6 py-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-black text-slate-900">HAD Checklist</h3>
            <p className="mt-1 text-xs font-bold text-slate-400">High-Alert Drug — ต้องกรอกก่อนส่งต่อ Dispensing</p>
          </div>
          <Button className="h-9 w-9 rounded-xl border-slate-200" onClick={onClose} size="icon" variant="outline">
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="max-h-[340px] overflow-y-auto px-6 py-3">
          {hadChecklistItems.map((item) => {
            const checked = Boolean(checkedItems[item.id]);

            return (
              <button
                className="flex w-full items-center gap-3 border-b border-slate-100 px-1 py-3 text-left last:border-b-0"
                key={item.id}
                onClick={() => onToggle(item.id)}
                type="button"
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition",
                    checked ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white text-transparent",
                  )}
                >
                  <CheckCircle2 className="h-4 w-4" />
                </span>
                <span className="text-sm font-bold leading-6 text-slate-700">{item.label}</span>
              </button>
            );
          })}
        </div>

        <footer className="flex gap-2 border-t border-slate-100 px-6 py-4">
          <Button className="h-11 rounded-xl border-slate-200 px-5" onClick={onClose} variant="outline">
            ยกเลิก
          </Button>
          <Button className="h-11 flex-1 rounded-xl bg-blue-600 text-white hover:bg-blue-700" onClick={onClose}>
            บันทึก & ส่งต่อ ({completedCount}/{hadChecklistItems.length})
          </Button>
        </footer>
      </section>
    </div>
  );
}

function MedicationErrorReportModal({
  category,
  description,
  onCategoryChange,
  onClose,
  onDescriptionChange,
  onSave,
  onSeverityChange,
  selectedSeverity,
  subtype,
  onSubtypeChange,
}: {
  category: MedicationErrorCategoryId | null;
  description: string;
  onCategoryChange: (category: MedicationErrorCategoryId) => void;
  onClose: () => void;
  onDescriptionChange: (value: string) => void;
  onSave: () => void;
  onSeverityChange: (severity: MedicationErrorSeverityKey) => void;
  selectedSeverity: MedicationErrorSeverityKey | null;
  subtype: string | null;
  onSubtypeChange: (subtype: string) => void;
}) {
  const selectedCategory = medicationErrorCategories.find((item) => item.id === category);
  const selectedSubtype = selectedCategory?.options.find((item) => item.id === subtype);
  const selectionPath = [
    selectedCategory?.label,
    selectedSubtype?.label,
    selectedSubtype && selectedSeverity ? `Severity ${selectedSeverity}` : undefined,
  ].filter(Boolean).join(" › ");
  const descriptionReady = description.trim().length > 0;
  const canSave = Boolean(category && subtype && selectedSeverity && descriptionReady);

  return (
    <div className="fixed inset-0 z-[72] flex items-center justify-center bg-[#0f1f3d]/45 p-4" onClick={onClose}>
      <section className="flex max-h-[92vh] w-full max-w-[660px] flex-col overflow-hidden rounded-3xl bg-white shadow-[0_30px_70px_rgba(15,31,61,0.4)]" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-center gap-3 border-b border-slate-100 px-6 py-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-black text-slate-900">รายงานความคลาดเคลื่อนทางยา</h3>
            <p className="mt-1 text-xs font-bold leading-5 text-slate-400">{selectionPath || "เลือกประเภทความคลาดเคลื่อน"}</p>
          </div>
          <Button className="h-9 w-9 rounded-xl border-slate-200" onClick={onClose} size="icon" variant="outline">
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="mb-3 text-sm font-black text-slate-800">ประเภทความคลาดเคลื่อน</div>
          <div className="grid gap-3 sm:grid-cols-3">
            {medicationErrorCategories.map((item) => (
              <MedicationErrorSelectionButton
                active={category === item.id}
                key={item.id}
                label={item.label}
                onClick={() => onCategoryChange(item.id)}
              />
            ))}
          </div>

          {selectedCategory ? (
            <section className="mt-6">
              <div className="text-sm font-black text-slate-800">รายการความคลาดเคลื่อน</div>
              <p className="mt-1 text-xs font-bold text-slate-400">เลือก 1 รายการจาก {selectedCategory.label}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {selectedCategory.options.map((option) => (
                  <MedicationErrorSelectionButton
                    active={subtype === option.id}
                    compact
                    key={`${selectedCategory.id}-${option.id}`}
                    label={option.label}
                    onClick={() => onSubtypeChange(option.id)}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {selectedSubtype ? (
            <section className="mt-6">
              <div className="text-sm font-black text-slate-800">Severity</div>
              <p className="mt-1 text-xs font-bold text-slate-400">เลือก 1 ระดับ — A: ยังไม่เกิด · B-D: ไม่เป็นอันตราย · E-H: เป็นอันตราย · I: เสียชีวิต</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {medicationErrorSeverities.map((severity) => {
                  const selected = selectedSeverity === severity.key;

                  return (
                    <button
                      className={cn(
                        "flex items-start gap-3 rounded-2xl border-2 bg-white p-3 text-left transition",
                        selected ? "shadow-sm" : "border-slate-100 hover:border-blue-200 hover:bg-blue-50/40",
                      )}
                      key={severity.key}
                      onClick={() => onSeverityChange(severity.key)}
                      style={selected ? { borderColor: severity.color, backgroundColor: `${severity.color}10` } : undefined}
                      type="button"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg font-black text-white" style={{ backgroundColor: severity.color }}>
                        {severity.key}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] font-black uppercase tracking-[0.04em]" style={{ color: severity.color }}>
                          {severity.category}
                        </span>
                        <span className="mt-1 block text-xs font-bold leading-5 text-slate-600">{severity.th}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section className="mt-6">
            <label className="text-sm font-black text-slate-800" htmlFor="medication-error-description">
              รายละเอียด / สาเหตุการแก้ไข
            </label>
            <textarea
              className="mt-2 min-h-28 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              id="medication-error-description"
              onChange={(event) => onDescriptionChange(event.target.value)}
              placeholder="อธิบายความคลาดเคลื่อนที่พบ การแก้ไข และผลต่อผู้ป่วย..."
              value={description}
            />
            {!canSave ? (
              <p className="mt-2 text-xs font-bold text-amber-600">
                กรุณาเลือกประเภท รายการความคลาดเคลื่อน ระดับ Severity และกรอกรายละเอียดก่อนบันทึกรายงาน
              </p>
            ) : null}
          </section>
        </div>

        <footer className="flex gap-3 border-t border-slate-100 px-6 py-4">
          <Button className="h-12 rounded-xl border-slate-200 px-6" onClick={onClose} variant="outline">
            ยกเลิก
          </Button>
          <Button className="h-12 flex-1 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-300" disabled={!canSave} onClick={onSave}>
            บันทึกรายงาน
          </Button>
        </footer>
      </section>
    </div>
  );
}

function MedicationErrorSelectionButton({
  active,
  compact = false,
  label,
  onClick,
}: {
  active: boolean;
  compact?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "flex items-center rounded-2xl border-2 bg-white px-4 font-black text-slate-500 transition",
        compact ? "min-h-12 justify-start py-3 text-left text-sm leading-5" : "min-h-14 justify-center py-3 text-center text-sm",
        active ? "border-rose-500 bg-rose-50 text-rose-700 shadow-sm" : "border-slate-200 hover:border-blue-200 hover:bg-blue-50/40",
      )}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}
