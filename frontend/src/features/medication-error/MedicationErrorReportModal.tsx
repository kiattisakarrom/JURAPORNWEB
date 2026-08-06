"use client";

import { AlertTriangle, Pill, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const medicationErrorCategories = [
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

export type MedicationErrorCategoryId = (typeof medicationErrorCategories)[number]["id"];

export const medicationErrorSeverities = [
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

export type MedicationErrorSeverityKey = (typeof medicationErrorSeverities)[number]["key"];

export type MedicationErrorDrug = {
  id: string;
  name: string;
  instruction?: string;
  quantity?: string;
  code?: string;
  stickerCode?: string;
  source?: string;
  machineCode?: string;
};

export function MedicationErrorReportModal({
  drug,
  onClose,
}: {
  drug: MedicationErrorDrug;
  onClose: () => void;
}) {
  const [category, setCategory] = useState<MedicationErrorCategoryId | null>(null);
  const [subtype, setSubtype] = useState<string | null>(null);
  const [selectedSeverity, setSelectedSeverity] = useState<MedicationErrorSeverityKey | null>(null);
  const [description, setDescription] = useState("");
  const selectedCategory = medicationErrorCategories.find((item) => item.id === category);
  const selectedSubtype = selectedCategory?.options.find((item) => item.id === subtype);
  const selectionPath = [
    selectedCategory?.label,
    selectedSubtype?.label,
    selectedSubtype && selectedSeverity ? `Severity ${selectedSeverity}` : undefined,
  ].filter(Boolean).join(" › ");
  const canSave = Boolean(category && subtype && selectedSeverity && description.trim());

  function selectCategory(nextCategory: MedicationErrorCategoryId) {
    setCategory(nextCategory);
    setSubtype(null);
    setSelectedSeverity(null);
  }

  function selectSubtype(nextSubtype: string) {
    setSubtype(nextSubtype);
    setSelectedSeverity("B");
  }

  return (
    <div className="fixed inset-0 z-[72] flex items-center justify-center bg-[#0f1f3d]/45 p-4" onClick={onClose}>
      <section className="flex max-h-[92vh] w-full max-w-[660px] flex-col overflow-hidden rounded-3xl bg-white shadow-[0_30px_70px_rgba(15,31,61,0.4)]" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-center gap-3 border-b border-slate-100 px-6 py-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-black text-slate-900">รายงานความคลาดเคลื่อนทางยา</h3>
            <p className="mt-1 truncate text-xs font-bold leading-5 text-slate-400">{drug.name} · {selectionPath || "เลือกประเภทความคลาดเคลื่อน"}</p>
          </div>
          <Button className="h-9 w-9 rounded-xl border-slate-200" onClick={onClose} size="icon" variant="outline">
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white"><Pill className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-black uppercase tracking-[0.08em] text-blue-500">ยาที่รายงานปัญหา</div>
                <div className="mt-1 text-base font-black text-blue-950">{drug.name}</div>
                {drug.instruction ? <div className="mt-1 text-xs font-bold leading-5 text-blue-700">{drug.instruction}</div> : null}
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-slate-500">
                  {drug.code ? <span>รหัสยา {drug.code}</span> : null}
                  {drug.stickerCode ? <span>สติกเกอร์ {drug.stickerCode}</span> : null}
                  {drug.quantity ? <span>จำนวน {drug.quantity}</span> : null}
                  {drug.source ? <span>แหล่งจ่าย {drug.source}</span> : null}
                  {drug.machineCode ? <span>เครื่อง {drug.machineCode}</span> : null}
                </div>
              </div>
            </div>
          </section>

          <div className="mb-3 mt-6 text-sm font-black text-slate-800">ประเภทความคลาดเคลื่อน</div>
          <div className="grid gap-3 sm:grid-cols-3">
            {medicationErrorCategories.map((item) => (
              <MedicationErrorSelectionButton active={category === item.id} key={item.id} label={item.label} onClick={() => selectCategory(item.id)} />
            ))}
          </div>

          {selectedCategory ? (
            <section className="mt-6">
              <div className="text-sm font-black text-slate-800">รายการความคลาดเคลื่อน</div>
              <p className="mt-1 text-xs font-bold text-slate-400">เลือก 1 รายการจาก {selectedCategory.label}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {selectedCategory.options.map((option) => (
                  <MedicationErrorSelectionButton active={subtype === option.id} compact key={`${selectedCategory.id}-${option.id}`} label={option.label} onClick={() => selectSubtype(option.id)} />
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
                      className={cn("flex items-start gap-3 rounded-2xl border-2 bg-white p-3 text-left transition", selected ? "shadow-sm" : "border-slate-100 hover:border-blue-200 hover:bg-blue-50/40")}
                      key={severity.key}
                      onClick={() => setSelectedSeverity(severity.key)}
                      style={selected ? { borderColor: severity.color, backgroundColor: `${severity.color}10` } : undefined}
                      type="button"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg font-black text-white" style={{ backgroundColor: severity.color }}>{severity.key}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] font-black uppercase tracking-[0.04em]" style={{ color: severity.color }}>{severity.category}</span>
                        <span className="mt-1 block text-xs font-bold leading-5 text-slate-600">{severity.th}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section className="mt-6">
            <label className="text-sm font-black text-slate-800" htmlFor="medication-error-description">รายละเอียด / สาเหตุการแก้ไข</label>
            <textarea
              className="mt-2 min-h-28 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              id="medication-error-description"
              onChange={(event) => setDescription(event.target.value)}
              placeholder="อธิบายความคลาดเคลื่อนที่พบ การแก้ไข และผลต่อผู้ป่วย..."
              value={description}
            />
            {!canSave ? <p className="mt-2 text-xs font-bold text-amber-600">กรุณาเลือกประเภท รายการความคลาดเคลื่อน ระดับ Severity และกรอกรายละเอียดก่อนบันทึกรายงาน</p> : null}
          </section>
        </div>

        <footer className="flex gap-3 border-t border-slate-100 px-6 py-4">
          <Button className="h-12 rounded-xl border-slate-200 px-6" onClick={onClose} variant="outline">ยกเลิก</Button>
          <Button className="h-12 flex-1 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-300" disabled={!canSave} onClick={onClose}>บันทึกรายงาน</Button>
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
