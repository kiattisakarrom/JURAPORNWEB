"use client";

import { AlignCenter, AlignLeft, AlignRight, Box, FileImage, Grip, Loader2, Minus, Plus, Printer, QrCode, RotateCcw, Save, Send, Trash2, Type } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ApiClientError } from "@/lib/api-client";
import {
  getDrugLabelTemplates,
  publishDrugLabelDraft,
  sampleDrugLabelData,
  saveDrugLabelDraft,
  saveDrugLabelLogo,
  type DrugLabelDataKey,
  type DrugLabelElement,
  type DrugLabelElementType,
  type DrugLabelTemplate,
  type DrugLabelTemplatePair,
} from "@/lib/drug-label-api";
import { openDrugLabelPrint } from "@/lib/drug-label-print";
import type { DrugMasterTab } from "@/lib/workspace-navigation";
import { cn } from "@/lib/utils";
import { DrugLabelCanvas } from "./DrugLabelCanvas";

const tabs: Array<{ id: DrugMasterTab; label: string }> = [
  { id: "allergy", label: "เพิ่มข้อมูลแพ้ยาผู้ป่วย" },
  { id: "interaction", label: "จับคู่ยาอันตราย" },
  { id: "label", label: "ตั้งค่าสติกเกอร์ยา" },
];

const fields: Array<{ key: DrugLabelDataKey; label: string }> = [
  { key: "patientName", label: "ชื่อผู้ป่วย" }, { key: "patientHn", label: "HN" }, { key: "visitVn", label: "VN" },
  { key: "visitDateTime", label: "วันที่/เวลา" }, { key: "doctorName", label: "แพทย์" }, { key: "itemCounter", label: "ลำดับฉลาก" },
  { key: "medicineCode", label: "รหัสยา" }, { key: "medicineName", label: "ชื่อยา" }, { key: "medicinePronunciation", label: "คำอ่านชื่อยา" },
  { key: "quantity", label: "จำนวน" }, { key: "doseMemo", label: "วิธีใช้ยา" }, { key: "indication", label: "ข้อบ่งใช้/คำเตือน" },
  { key: "expiryDate", label: "วันหมดอายุ" }, { key: "storageInstruction", label: "การเก็บรักษา" },
];

export function DrugMasterScreen({ tab, onTabChange }: { tab: DrugMasterTab; onTabChange: (tab: DrugMasterTab) => void }) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f7f9fc]">
      <nav className="shrink-0 overflow-x-auto border-b border-slate-200 bg-white px-4 md:px-7">
        <div className="flex min-w-max gap-1">
          {tabs.map((item) => <button className={cn("relative h-14 px-4 text-sm font-bold text-slate-500 transition hover:text-blue-700", tab === item.id && "text-blue-700")} key={item.id} onClick={() => onTabChange(item.id)} type="button">{item.label}{tab === item.id ? <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-t bg-blue-600" /> : null}</button>)}
        </div>
      </nav>
      {tab === "label" ? <DrugLabelDesigner /> : <ComingSoon title={tab === "allergy" ? "เพิ่มข้อมูลแพ้ยาผู้ป่วย" : "จับคู่ยาอันตราย"} />}
    </div>
  );
}

function ComingSoon({ title }: { title: string }) {
  return <div className="flex flex-1 items-center justify-center p-6"><section className="w-full max-w-xl rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm"><div className="text-2xl font-black text-slate-900">{title}</div><p className="mt-3 font-semibold text-slate-500">Coming soon</p></section></div>;
}

function DrugLabelDesigner() {
  const [pair, setPair] = useState<DrugLabelTemplatePair | null>(null);
  const [draft, setDraft] = useState<DrugLabelTemplate | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = useMemo(() => draft?.DEFINITION.elements.find((element) => element.id === selectedId) ?? null, [draft, selectedId]);

  useEffect(() => {
    let active = true;
    void getDrugLabelTemplates().then((result) => {
      if (!active) return;
      const normalized = normalizeTemplatePair(result);
      setPair(normalized.pair);
      setDraft(normalized.pair.DRAFT);
      setDirty(normalized.draftChanged);
      setLoading(false);
    }).catch((reason) => { if (active) { setError(readError(reason)); setLoading(false); } });
    return () => { active = false; };
  }, []);

  function replaceElement(next: DrugLabelElement) {
    if (!draft) return;
    setDraft({ ...draft, DEFINITION: { ...draft.DEFINITION, elements: draft.DEFINITION.elements.map((item) => item.id === next.id ? next : item) } });
    setDirty(true);
  }

  function addElement(type: DrugLabelElementType, dataKey?: DrugLabelDataKey) {
    if (!draft) return;
    const id = `${type}-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;
    const next: DrugLabelElement = {
      id, type, xMm: 8, yMm: 8, widthMm: type === "qr" ? 21 : type === "line" ? 50 : 32,
      heightMm: type === "qr" ? 21 : type === "line" ? 1 : 10,
      zIndex: Math.max(0, ...draft.DEFINITION.elements.map((element) => element.zIndex)) + 1,
      ...(type === "text" ? { text: "ข้อความใหม่" } : {}),
      ...(type === "field" || type === "qr" ? { dataKey: dataKey ?? (type === "qr" ? "qrToken" : "patientName") } : {}),
      fontFamily: "Sarabun", fontSizePt: 10, fontWeight: 400, textAlign: "left", color: "#111827",
      ...(type === "box" ? { backgroundColor: "#dbeafe", borderColor: "#2563eb", borderWidth: 0.3 } : {}),
      ...(type === "line" ? { borderColor: "#0f172a", borderWidth: 0.4, lineStyle: "dashed" as const } : {}),
    };
    setDraft({ ...draft, DEFINITION: { ...draft.DEFINITION, elements: [...draft.DEFINITION.elements, next] } });
    setSelectedId(id); setDirty(true);
  }

  function removeSelected() {
    if (!draft || !selected) return;
    setDraft({ ...draft, DEFINITION: { ...draft.DEFINITION, elements: draft.DEFINITION.elements.filter((element) => element.id !== selected.id) } });
    setSelectedId(null); setDirty(true);
  }

  async function saveDraft(showToast = true) {
    if (!draft) return null;
    setSaving(true);
    try {
      const result = await saveDrugLabelDraft({ expectedRowVersion: draft.ROW_VERSION, widthMm: draft.WIDTH_MM, heightMm: draft.HEIGHT_MM, definition: draft.DEFINITION, actorName: "Pharmacist" });
      const normalized = normalizeTemplatePair(result);
      setPair(normalized.pair); setDraft(normalized.pair.DRAFT); setDirty(normalized.draftChanged);
      if (showToast) toast.success("บันทึก Draft แล้ว");
      return result;
    } catch (reason) {
      toast.error(readError(reason)); return null;
    } finally { setSaving(false); }
  }

  async function publish() {
    let current = pair;
    if (dirty) current = await saveDraft(false);
    if (!current) return;
    setSaving(true);
    try {
      const result = await publishDrugLabelDraft(current.DRAFT.ROW_VERSION, "Pharmacist");
      const normalized = normalizeTemplatePair(result);
      setPair(normalized.pair); setDraft(normalized.pair.DRAFT); setDirty(normalized.draftChanged);
      toast.success(`เปิดใช้งานเทมเพลตเวอร์ชัน ${result.ACTIVE.VERSION_NO} แล้ว`);
    } catch (reason) { toast.error(readError(reason)); } finally { setSaving(false); }
  }

  async function uploadLogo(file: File | undefined) {
    if (!file || !draft) return;
    if (!["image/png", "image/jpeg"].includes(file.type) || file.size > 1024 * 1024) { toast.error("รองรับ PNG/JPG ขนาดไม่เกิน 1 MB"); return; }
    const base64 = await fileToBase64(file);
    setSaving(true);
    try {
      const result = await saveDrugLabelLogo({ expectedRowVersion: draft.ROW_VERSION, mimeType: file.type as "image/png" | "image/jpeg", dataBase64: base64, actorName: "Pharmacist" });
      const normalized = normalizeTemplatePair(result);
      setPair(normalized.pair); setDraft(normalized.pair.DRAFT); setDirty(normalized.draftChanged); toast.success("เปลี่ยนโลโก้ใน Draft แล้ว");
    } catch (reason) { toast.error(readError(reason)); } finally { setSaving(false); }
  }

  if (loading) return <div className="flex flex-1 items-center justify-center gap-3 font-bold text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />กำลังโหลดเทมเพลต...</div>;
  if (error || !draft || !pair) return <div className="m-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800"><h2 className="font-black">เปิดตัวออกแบบสติกเกอร์ไม่ได้</h2><p className="mt-2 text-sm font-semibold">{error ?? "ไม่พบเทมเพลต"}</p><p className="mt-2 text-xs">ตรวจว่าได้รัน migration 010_drug_label_templates.sql ในฐานข้อมูลที่เลือกแล้ว</p></div>;

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto xl:grid-cols-[230px_minmax(580px,1fr)_280px] xl:overflow-hidden">
      <aside className="border-b border-slate-200 bg-white p-4 xl:overflow-y-auto xl:border-b-0 xl:border-r">
        <h2 className="text-lg font-black text-slate-950">เพิ่ม Element</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 xl:grid-cols-1">
          <ToolButton icon={Type} label="ข้อความ" onClick={() => addElement("text")} />
          <ToolButton icon={Grip} label="Dynamic field" onClick={() => addElement("field")} />
          <ToolButton icon={QrCode} label="QR รหัสสติกเกอร์" onClick={() => addElement("qr", "qrToken")} />
          <ToolButton icon={FileImage} label="โลโก้ / รูปภาพ" onClick={() => addElement("logo")} />
          <ToolButton icon={Minus} label="เส้น" onClick={() => addElement("line")} />
          <ToolButton icon={Box} label="กล่อง" onClick={() => addElement("box")} />
        </div>
        <div className="mt-5 border-t border-slate-200 pt-4">
          <div className="text-sm font-black text-slate-800">ส่วนหัวโรงพยาบาล</div>
          <div className="mt-2 grid gap-2">
            <HeaderElementButton active={selectedId === "logo"} label="ตราสัญลักษณ์" onClick={() => setSelectedId("logo")} />
            <HeaderElementButton active={selectedId === "hospital_name"} label="ชื่อโรงพยาบาล" onClick={() => setSelectedId("hospital_name")} />
            <HeaderElementButton active={selectedId === "hospital_phone"} label="เบอร์โทรศัพท์" onClick={() => setSelectedId("hospital_phone")} />
          </div>
          <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">ทั้ง 3 ส่วนเป็นคนละ element จึงลากและปรับขนาดแยกกันได้</p>
        </div>
        <label className="mt-5 block text-sm font-black text-slate-700">เปลี่ยนโลโก้ PNG/JPG
          <input accept="image/png,image/jpeg" className="mt-2 block w-full text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:font-bold file:text-blue-700" onChange={(event) => void uploadLogo(event.target.files?.[0])} type="file" />
        </label>
        <div className="mt-6 rounded-xl bg-slate-50 p-3 text-xs font-semibold leading-5 text-slate-500">ลาก element บนฉลากเพื่อย้ายตำแหน่ง และลากจุดสีน้ำเงินมุมขวาล่างเพื่อปรับขนาด</div>
      </aside>

      <main className="min-h-[620px] overflow-auto bg-[#e9edf4] p-4 md:p-7 xl:min-h-0">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-700">Draft v{draft.VERSION_NO}</span>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">Active v{pair.ACTIVE.VERSION_NO}</span>
          {dirty ? <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-700">ยังไม่บันทึก</span> : null}
          <div className="flex-1" />
          <Button disabled={saving} onClick={() => { setDraft({ ...draft, WIDTH_MM: pair.ACTIVE.WIDTH_MM, HEIGHT_MM: pair.ACTIVE.HEIGHT_MM, DEFINITION: structuredClone(pair.ACTIVE.DEFINITION) }); setSelectedId(null); setDirty(true); }} size="sm" variant="outline"><RotateCcw className="h-4 w-4" />คืนค่า Layout Active</Button>
          <Button disabled={saving} onClick={() => void openDrugLabelPrint({ TEMPLATE: draft, DATA: sampleDrugLabelData })} size="sm" variant="outline"><Printer className="h-4 w-4" />ทดสอบพิมพ์</Button>
          <Button disabled={saving || !dirty} onClick={() => void saveDraft()} size="sm" variant="outline"><Save className="h-4 w-4" />บันทึก Draft</Button>
          <Button disabled={saving} onClick={() => void publish()} size="sm"><Send className="h-4 w-4" />บันทึกและใช้งาน</Button>
        </div>
        <div className="mx-auto mb-3 flex max-w-[940px] items-center justify-between text-xs font-bold text-slate-500"><span>{(draft.WIDTH_MM / 25.4).toFixed(2)} × {(draft.HEIGHT_MM / 25.4).toFixed(2)} นิ้ว</span><span>{draft.WIDTH_MM.toFixed(1)} × {draft.HEIGHT_MM.toFixed(1)} mm</span></div>
        <DrugLabelCanvas data={sampleDrugLabelData} interactive onElementChange={replaceElement} onSelect={setSelectedId} selectedId={selectedId} template={draft} />
      </main>

      <aside className="border-t border-slate-200 bg-white p-4 xl:overflow-y-auto xl:border-l xl:border-t-0">
        <h2 className="text-lg font-black text-slate-950">ตั้งค่า</h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <NumberInput label="กว้าง (นิ้ว)" value={draft.WIDTH_MM / 25.4} onChange={(value) => { setDraft({ ...draft, WIDTH_MM: Math.max(25.4, value * 25.4) }); setDirty(true); }} />
          <NumberInput label="สูง (นิ้ว)" value={draft.HEIGHT_MM / 25.4} onChange={(value) => { setDraft({ ...draft, HEIGHT_MM: Math.max(25.4, value * 25.4) }); setDirty(true); }} />
        </div>
        {!selected ? <p className="mt-8 rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">เลือก element บนฉลากเพื่อแก้ไขรายละเอียด</p> : (
          <div className="mt-5 space-y-4">
            <div className="flex items-center justify-between"><div><span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-black uppercase text-blue-700">{selected.type}</span><div className="mt-2 font-mono text-[11px] font-bold text-slate-400">{selected.id}</div></div><button aria-label="ลบ element" className="rounded-lg p-2 text-red-600 hover:bg-red-50" onClick={removeSelected} type="button"><Trash2 className="h-4 w-4" /></button></div>
            {selected.type === "text" ? <TextInput label="ข้อความ" value={selected.text ?? ""} onChange={(value) => replaceElement({ ...selected, text: value })} /> : null}
            {selected.type === "field" ? <label className="block text-xs font-black text-slate-600">Dynamic field<select className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-2 text-sm" onChange={(event) => replaceElement({ ...selected, dataKey: event.target.value as DrugLabelDataKey })} value={selected.dataKey}>{fields.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}</select></label> : null}
            <div className="grid grid-cols-2 gap-3"><NumberInput label="X (mm)" value={selected.xMm} onChange={(value) => replaceElement({ ...selected, xMm: value })} /><NumberInput label="Y (mm)" value={selected.yMm} onChange={(value) => replaceElement({ ...selected, yMm: value })} /><NumberInput label="กว้าง (mm)" value={selected.widthMm} onChange={(value) => replaceElement({ ...selected, widthMm: value })} /><NumberInput label="สูง (mm)" value={selected.heightMm} onChange={(value) => replaceElement({ ...selected, heightMm: value })} /></div>
            {!['logo','qr','line','box'].includes(selected.type) ? <><div className="grid grid-cols-2 gap-3"><NumberInput label="ขนาดตัวอักษร (pt)" value={selected.fontSizePt ?? 10} onChange={(value) => replaceElement({ ...selected, fontSizePt: value })} /><NumberInput label="น้ำหนัก" step={100} value={selected.fontWeight ?? 400} onChange={(value) => replaceElement({ ...selected, fontWeight: value })} /></div><div className="flex gap-2"><AlignButton active={selected.textAlign === "left" || !selected.textAlign} icon={AlignLeft} onClick={() => replaceElement({ ...selected, textAlign: "left" })} /><AlignButton active={selected.textAlign === "center"} icon={AlignCenter} onClick={() => replaceElement({ ...selected, textAlign: "center" })} /><AlignButton active={selected.textAlign === "right"} icon={AlignRight} onClick={() => replaceElement({ ...selected, textAlign: "right" })} /></div></> : null}
            <div className="grid grid-cols-2 gap-3"><ColorInput label="สี" value={selected.color ?? "#111827"} onChange={(value) => replaceElement({ ...selected, color: value })} /><ColorInput label="พื้นหลัง" value={normalizeColor(selected.backgroundColor)} onChange={(value) => replaceElement({ ...selected, backgroundColor: value })} /><ColorInput label="เส้นขอบ" value={normalizeColor(selected.borderColor)} onChange={(value) => replaceElement({ ...selected, borderColor: value })} /><NumberInput label="ขอบ (mm)" step={0.1} value={selected.borderWidth ?? 0} onChange={(value) => replaceElement({ ...selected, borderWidth: value })} /></div>
            <div className="grid grid-cols-2 gap-2"><Button onClick={() => replaceElement({ ...selected, zIndex: selected.zIndex + 1 })} size="sm" variant="outline"><Plus className="h-3.5 w-3.5" />ชั้นหน้า</Button><Button onClick={() => replaceElement({ ...selected, zIndex: Math.max(0, selected.zIndex - 1) })} size="sm" variant="outline"><Minus className="h-3.5 w-3.5" />ชั้นหลัง</Button></div>
          </div>
        )}
      </aside>
    </div>
  );
}

function ToolButton({ icon: Icon, label, onClick }: { icon: typeof Type; label: string; onClick: () => void }) { return <button className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-left text-sm font-bold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700" onClick={onClick} type="button"><Icon className="h-4 w-4" />{label}</button>; }
function HeaderElementButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) { return <button className={cn("rounded-lg border px-3 py-2 text-left text-xs font-bold transition", active ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:border-blue-300")} onClick={onClick} type="button">{label}</button>; }
function AlignButton({ icon: Icon, active, onClick }: { icon: typeof AlignLeft; active: boolean; onClick: () => void }) { return <button className={cn("flex h-9 flex-1 items-center justify-center rounded-lg border", active ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-500")} onClick={onClick} type="button"><Icon className="h-4 w-4" /></button>; }
function NumberInput({ label, value, onChange, step = 0.1 }: { label: string; value: number; onChange: (value: number) => void; step?: number }) { return <label className="block text-xs font-black text-slate-600">{label}<input className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-2 text-sm" min="0" onChange={(event) => onChange(Number(event.target.value) || 0)} step={step} type="number" value={Math.round(value * 100) / 100} /></label>; }
function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block text-xs font-black text-slate-600">{label}<textarea className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 p-2 text-sm" onChange={(event) => onChange(event.target.value)} value={value} /></label>; }
function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block text-xs font-black text-slate-600">{label}<input className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white p-1" onChange={(event) => onChange(event.target.value)} type="color" value={value} /></label>; }
function normalizeColor(value?: string) { return /^#[0-9a-f]{6}$/i.test(value ?? "") ? value! : "#ffffff"; }
function normalizeTemplatePair(pair: DrugLabelTemplatePair) {
  const draft = normalizeHospitalHeader(pair.DRAFT);
  const active = normalizeHospitalHeader(pair.ACTIVE);
  return { pair: { DRAFT: draft.template, ACTIVE: active.template }, draftChanged: draft.changed };
}

function normalizeHospitalHeader(template: DrugLabelTemplate): { template: DrugLabelTemplate; changed: boolean } {
  const elements = template.DEFINITION.elements.map((element) => ({ ...element }));
  let changed = false;
  const logo = elements.find((element) => element.id === "logo");
  if (logo && (logo.imageSrc !== "/assets/juraporn-hospital-emblem.png" || logo.widthMm > 12)) {
    Object.assign(logo, { xMm: 5, yMm: 4, widthMm: 8, heightMm: 14, imageSrc: "/assets/juraporn-hospital-emblem.png" });
    changed = true;
  }
  if (!elements.some((element) => element.id === "hospital_name")) {
    elements.push({ id: "hospital_name", type: "text", text: "โรงพยาบาลจุฬาภรณ์", xMm: 14, yMm: 6, widthMm: 24, heightMm: 5, zIndex: 3, fontFamily: "Sarabun", fontSizePt: 8, fontWeight: 600, textAlign: "left", color: "#244487" });
    changed = true;
  }
  if (!elements.some((element) => element.id === "hospital_phone")) {
    elements.push({ id: "hospital_phone", type: "text", text: "Tel. 02 576 6000 หรือ 1118", xMm: 14, yMm: 12, widthMm: 25, heightMm: 4, zIndex: 3, fontFamily: "Sarabun", fontSizePt: 7, fontWeight: 500, textAlign: "left", color: "#244487" });
    changed = true;
  }
  return {
    changed,
    template: {
      ...template,
      LOGO_DATA_URL: template.LOGO_DATA_URL || "/assets/juraporn-hospital-emblem.png",
      DEFINITION: { ...template.DEFINITION, elements },
    },
  };
}
function fileToBase64(file: File) { return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1] ?? ""); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); }); }
function readError(reason: unknown) { if (reason instanceof ApiClientError) return reason.message; return reason instanceof Error ? reason.message : "เกิดข้อผิดพลาด กรุณาลองใหม่"; }
