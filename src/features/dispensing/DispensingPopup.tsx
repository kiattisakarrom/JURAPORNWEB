"use client";

import { Activity, AlertTriangle, CheckCircle2, FileText, ImageIcon, Pill, RotateCcw, Search, ShieldCheck, UserRound, X } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PatientProfilePopup } from "@/features/patient-profile/PatientProfilePopup";
import { getDispensingCheckout } from "@/lib/pharmacy-api";
import { cn } from "@/lib/utils";
import type { DispensingCheckoutResponse, PatientQueueItem } from "@/types/pharmacy";

export function DispensingPopup({ patient, onClose }: { patient: PatientQueueItem; onClose: () => void }) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const { data: dispensing, isLoading } = useQuery({
    queryKey: ["dispensing-checkout", patient.id],
    queryFn: () => getDispensingCheckout(patient),
  });

  function closeTopLayer() {
    if (isProfileOpen) {
      setIsProfileOpen(false);
      return;
    }

    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex h-dvh justify-end bg-slate-950/25 backdrop-blur-[1px]">
      <button aria-label="ปิดหน้าจ่ายยา" className="hidden flex-1 cursor-default lg:block" onClick={closeTopLayer} type="button" />
      <div className="flex h-full w-full justify-end gap-3 p-0 sm:p-3 lg:w-auto">
        {isProfileOpen ? <PatientProfilePopup patient={patient} onClose={() => setIsProfileOpen(false)} /> : null}
        <aside
          className={cn(
            "relative h-full w-full overflow-hidden border-l border-slate-200 bg-white shadow-2xl shadow-slate-900/20 sm:rounded-2xl sm:border",
            isProfileOpen
              ? "md:w-[calc(100vw-24px)] md:min-w-0 xl:w-[calc(100vw-556px)]"
              : "md:w-[calc(100vw-24px)] md:min-w-0",
          )}
        >
          <Button className="absolute right-4 top-4 z-20 bg-white/95 shadow-sm backdrop-blur hover:bg-white" onClick={closeTopLayer} size="icon" variant="ghost">
            <X className="h-5 w-5" />
          </Button>
          <div className="h-full overflow-y-auto bg-white p-5">
            {isLoading || !dispensing ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm font-bold text-slate-500">กำลังโหลดข้อมูล Dispensing...</div>
            ) : (
              <DispensingContent dispensing={dispensing} onOpenProfile={() => setIsProfileOpen(true)} />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function DispensingContent({ dispensing, onOpenProfile }: { dispensing: DispensingCheckoutResponse; onOpenProfile: () => void }) {
  const [headerScanCode, setHeaderScanCode] = useState("");
  const [checkoutScanCode, setCheckoutScanCode] = useState("");

  return (
    <div className="flex min-h-full flex-col gap-4">
      <div className="flex flex-col gap-3 pr-12 lg:flex-row lg:items-center lg:justify-between">
        <div className="mb-4 flex items-center gap-2 text-lg font-black text-slate-900">
          <Activity className="h-4 w-4 text-blue-600" />
          Dispensing
        </div>
        <div className="grid gap-3 sm:grid-cols-[180px_minmax(260px,1fr)] lg:w-[620px]">
          <Button className="bg-blue-50 text-blue-700 hover:bg-blue-100" onClick={onOpenProfile} variant="secondary">
            <UserRound className="h-4 w-4" />
            Subjective
          </Button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="bg-white pl-9 font-bold placeholder:text-slate-400"
              placeholder={dispensing.basketScanPlaceholder}
              value={headerScanCode}
              onChange={(event) => setHeaderScanCode(event.target.value)}
            />
          </div>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2 text-base font-black text-slate-900">
            <FileText className="h-4 w-4 text-blue-600" />
            รายการสั่งยาจากแพทย์ (Prescription)
          </div>
          <span className="text-sm font-black text-blue-700">ทั้งหมด {dispensing.totalItems} รายการ</span>
        </div>
        <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
          {dispensing.prescriptionItems.map((item, index) => (
            <button
              className={cn(
                "grid w-full gap-3 px-5 py-4 text-left transition hover:bg-blue-50/50 sm:grid-cols-[44px_minmax(0,1fr)_150px] sm:items-center",
                item.status === "scanning" && "bg-blue-50/70",
              )}
              key={item.id}
              type="button"
            >
              <span className="text-sm font-black text-slate-400">{index + 1}</span>
              <span className="min-w-0">
                <span className="block truncate font-black text-slate-900">{item.drugName}</span>
                <span className="mt-1 block text-sm font-semibold text-slate-500">วิธีใช้: {item.instruction}</span>
              </span>
              <span className="sm:justify-self-end">
                <DispensingStatusBadge status={item.status} />
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-sm">
        <div className="grid gap-4 border-b border-orange-100 bg-orange-50/70 p-5 xl:grid-cols-[1fr_380px]">
          <div className="border-l-8 border-orange-500 pl-4">
            <div className="text-sm font-black text-orange-700">ขั้นตอนการจ่ายยาตามลำดับ</div>
            <div className="mt-1 text-base font-black text-slate-900">โปรดสแกนบาร์โค้ดเพื่อรอจ่าย/แสกนเพื่อยืนยัน</div>
          </div>
          <Input
            className="border-slate-200 bg-white font-bold placeholder:text-slate-400"
            placeholder="สแกนบาร์โคดยา..."
            value={checkoutScanCode}
            onChange={(event) => setCheckoutScanCode(event.target.value)}
          />
        </div>

        <div className="p-5">
          <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <Badge className="mb-3 bg-orange-500 text-white">กำลังตรวจสอบ (Active)</Badge>
              <h2 className="text-2xl font-black text-slate-950">{dispensing.activeItem.drugName}</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">Generic Name: {dispensing.activeItem.genericName}</p>
            </div>
            <div className="text-left lg:text-right">
              <div className="text-xs font-black text-slate-400">จำนวนที่ต้องจ่าย</div>
              <div className="mt-1 text-4xl font-black text-blue-700">
                {dispensing.activeItem.amount} <span className="text-base text-slate-500">{dispensing.activeItem.unit}</span>
              </div>
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-500">
              <ImageIcon className="h-4 w-4" />
              รูปหน้าซองยา / แผง 1 (3 ทิศทาง)
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              {dispensing.activeItem.imageSlots.map((slot) => (
                <div className="flex aspect-[16/5] min-h-28 items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 text-slate-400" key={slot.id}>
                  <div className="text-center">
                    <Badge className="mb-3 bg-slate-800 text-white">{slot.label}</Badge>
                    <ImageIcon className="mx-auto h-6 w-6 text-slate-300" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_1fr]">
            <InfoPanel tone="blue" title="วิธีใช้ (Directions)">
              {dispensing.activeItem.directions}
            </InfoPanel>
            <InfoPanel tone="amber" title="ข้อควรระวัง / คำเตือน (Precautions)">
              {dispensing.activeItem.precautions}
            </InfoPanel>
          </div>
        </div>
      </section>

      <section className="mt-auto flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:flex-row md:items-center md:justify-between">
        <Button className="border-red-200 text-red-600 hover:bg-red-50" variant="outline">
          <X className="h-4 w-4" />
          คนไข้ไม่รับยาตัวนี้
        </Button>
        <div className="flex flex-col gap-2 text-center text-sm font-black text-slate-500 md:flex-row md:items-center md:gap-8">
          <span>สถานะตะกร้า: <span className="text-orange-600">{dispensing.queueStatus}</span></span>
          <span>ความคืบหน้า: {dispensing.progressText}</span>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button variant="outline">
            <RotateCcw className="h-4 w-4" />
            Hold
          </Button>
          <Button className="bg-emerald-600 text-white hover:bg-emerald-700">
            <ShieldCheck className="h-4 w-4" />
            ยืนยันยาถูกต้อง
          </Button>
        </div>
      </section>
    </div>
  );
}

function DispensingStatusBadge({ status }: { status: DispensingCheckoutResponse["prescriptionItems"][number]["status"] }) {
  if (status === "done") {
    return (
      <Badge className="bg-emerald-50 text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        จัดแล้ว
      </Badge>
    );
  }

  if (status === "scanning") {
    return <Badge className="bg-orange-50 text-orange-700">กำลังสแกน</Badge>;
  }

  return <Badge className="bg-slate-100 text-slate-500">รอสแกน</Badge>;
}

function InfoPanel({ title, tone, children }: { title: string; tone: "blue" | "amber"; children: string }) {
  return (
    <div className={cn("rounded-2xl border p-5", tone === "blue" ? "border-blue-100 bg-blue-50 text-blue-900" : "border-amber-100 bg-amber-50 text-amber-900")}>
      <div className="mb-2 flex items-center gap-2 text-sm font-black">
        {tone === "blue" ? <Pill className="h-4 w-4 text-blue-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
        {title}
      </div>
      <p className="text-sm font-semibold leading-6 text-slate-700">{children}</p>
    </div>
  );
}
