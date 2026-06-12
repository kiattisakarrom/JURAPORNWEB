"use client";

import { Activity, Barcode, FileText, Pill, RotateCcw, Save, Search, ShoppingBasket, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCheckingCheckout } from "@/lib/pharmacy-api";
import { cn } from "@/lib/utils";
import type { CheckingCheckoutResponse, PatientQueueItem } from "@/types/pharmacy";
import { PatientProfilePopup } from "@/features/patient-profile/PatientProfilePopup";

export function CheckingCheckoutPopup({ patient, onClose }: { patient: PatientQueueItem; onClose: () => void }) {
  const [isProfileOpen, setIsProfileOpen] = useState(true);
  const { data: checkout, isLoading } = useQuery({
    queryKey: ["checking-checkout", patient.id],
    queryFn: () => getCheckingCheckout(patient),
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/25 backdrop-blur-[1px]">
      <button aria-label="ปิดหน้าตรวจเช็กยา" className="hidden flex-1 cursor-default lg:block" onClick={onClose} type="button" />
      <div className="flex h-full w-full justify-end gap-3 p-0 sm:p-3 lg:w-auto">
        {isProfileOpen ? <PatientProfilePopup patient={patient} onClose={() => setIsProfileOpen(false)} /> : null}
        <aside className="relative h-full w-full overflow-y-auto border-l border-slate-200 bg-slate-100 shadow-2xl shadow-slate-900/20 sm:rounded-2xl sm:border lg:w-[60vw] lg:min-w-[760px]">
          <Button className="absolute right-4 top-4 z-20 bg-white/90 shadow-sm backdrop-blur hover:bg-white" onClick={onClose} size="icon" variant="ghost">
            <X className="h-5 w-5" />
          </Button>
          <div className="space-y-4 p-4">
            {isLoading || !checkout ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm font-bold text-slate-500">กำลังโหลดข้อมูล Checking...</div>
            ) : (
              <CheckingCheckoutContent checkout={checkout} />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function CheckingCheckoutContent({ checkout }: { checkout: CheckingCheckoutResponse }) {
  return (
    <>
      <section>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-[0.08em] text-slate-500">
            <Activity className="h-4 w-4 text-blue-600" />
            สรุปภาระงานในคิวนี้ (Visit Summary)
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <SummaryTile icon={<FileText className="h-6 w-6" />} label="จำนวนใบยาทั้งหมด" tone="blue" value={`${checkout.summary.prescriptions} ใบสั่ง`} />
            <SummaryTile icon={<ShoppingBasket className="h-6 w-6" />} label="จำนวนตะกร้าทั้งหมด" tone="orange" value={`${checkout.summary.baskets} ตะกร้า`} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.08em] text-blue-700">
            <Search className="h-4 w-4" />
            ค้นหาตะกร้า (Basket Lookup)
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9 font-black" readOnly value={checkout.basketLookup} />
          </div>
          <p className="mt-3 text-xs font-black text-emerald-600">
            กำลังทำงานที่ตะกร้า: {checkout.basketLookup} (ตะกร้านี้จะล็อกชั่วคราว)
          </p>
        </div>

        <div className="rounded-2xl border border-orange-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.08em] text-orange-600">
            <Barcode className="h-4 w-4" />
            สแกนบาร์โค้ดเช็คเอาต์ (Scan Checkout)
          </div>
          <div className="relative">
            <Barcode className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-orange-400" />
            <Input className="border-orange-200 pl-9 font-bold text-orange-700 focus:border-orange-400 focus:ring-orange-100" readOnly value={checkout.scanPlaceholder} />
          </div>
          <p className="mt-3 text-xs font-bold text-slate-400">ยืนยันโค้ดยาด้วย Auto-Checkbox รายการยาในตะกร้าปัจจุบัน</p>
        </div>
      </section>

      <section className="space-y-4">
        {checkout.prescriptions.map((prescription, index) => (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" key={prescription.id}>
            <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <Badge className={index === 0 ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-500"}>ใบยาที่ {index + 1}</Badge>
                <span className="text-sm font-black text-slate-600">เลขที่ใบสั่งยา: {prescription.rxNo}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-black text-slate-500">
                <span>List เสาตะกร้าในใบนี้:</span>
                {prescription.baskets.map((basket) => (
                  <Badge className={basket === checkout.basketLookup ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200" : "bg-slate-100 text-slate-500"} key={basket}>
                    {basket}
                  </Badge>
                ))}
              </div>
            </div>

            {prescription.items.length ? (
              <div className="divide-y divide-slate-100">
                {prescription.items.map((item) => (
                  <CheckingDrugRow item={item} key={item.id} />
                ))}
              </div>
            ) : (
              <div className="bg-slate-50 px-4 py-8 text-center text-sm font-bold text-slate-400">
                รายการยาในใบยานี้ถูกผูกกับตะกร้าอื่น กรุณาเปลี่ยนเลขตะกร้าในระบบกลางเพื่อตรวจสอบ
              </div>
            )}
          </div>
        ))}
      </section>

      <div className="sticky bottom-0 -mx-4 -mb-4 flex flex-col gap-3 border-t border-slate-200 bg-white/95 p-4 backdrop-blur sm:flex-row sm:justify-end">
        <Button variant="outline">
          <RotateCcw className="h-4 w-4" />
          Hold / ส่งกลับจุดเดิม
        </Button>
        <Button className="bg-orange-500 text-white hover:bg-orange-600">
          <Save className="h-4 w-4" />
          บันทึกข้อมูลเช็คเอาต์ & ปิดคิว
        </Button>
      </div>
    </>
  );
}

function SummaryTile({ icon, label, value, tone }: { icon: ReactNode; label: string; value: string; tone: "blue" | "orange" }) {
  return (
    <div className={cn("rounded-2xl border p-4", tone === "blue" ? "border-blue-100 bg-blue-50 text-blue-700" : "border-orange-100 bg-orange-50 text-orange-600")}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-slate-500">{label}</div>
          <div className="mt-2 text-2xl font-black">{value}</div>
        </div>
        <div className="rounded-xl bg-white p-3 shadow-sm">{icon}</div>
      </div>
    </div>
  );
}

function CheckingDrugRow({ item }: { item: CheckingCheckoutResponse["prescriptions"][number]["items"][number] }) {
  const isChecked = item.status === "checked";
  const isLocked = item.status === "locked";

  return (
    <div className={cn("grid gap-4 px-4 py-4 lg:grid-cols-[34px_1fr_110px_minmax(260px,1fr)_90px]", isLocked && "bg-slate-50 opacity-60")}>
      <div className="flex items-center">
        <span className={cn("flex h-5 w-5 items-center justify-center rounded border text-white", isChecked ? "border-orange-500 bg-orange-500" : "border-slate-300 bg-white")}>
          {isChecked ? "✓" : ""}
        </span>
      </div>
      <div className="flex min-w-0 gap-3">
        <div className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border", isLocked ? "border-slate-200 bg-slate-200 text-slate-400" : "border-slate-200 bg-white text-red-600")}>
          <Pill className="h-7 w-7" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-base font-black text-slate-900">{item.drugName}</div>
          <div className="mt-1 text-xs font-bold text-slate-400">วันที่จ่าย: {item.dispenseDate}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge className="bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">{item.diStatus}</Badge>
            <Badge className="bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">{item.allergyStatus}</Badge>
          </div>
        </div>
      </div>
      <div className="flex items-center text-base font-black text-slate-600">{item.quantity}</div>
      <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm font-bold leading-6 text-slate-500">
        <span className="text-blue-700">วิธีใช้:</span> {item.instruction}
      </div>
      <div className="flex flex-col items-end justify-center gap-1 text-xs font-black">
        <Badge className={isLocked ? "bg-slate-200 text-slate-500" : "bg-blue-100 text-blue-700"}>{item.machineLabel}</Badge>
        <span className="text-emerald-600">{item.basketCode}</span>
      </div>
    </div>
  );
}
