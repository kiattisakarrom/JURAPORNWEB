"use client";

import { AlertTriangle, Boxes, Pill, Search, UserRound, X } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getMachineStockCheck } from "@/lib/stock-check-api";
import { cn } from "@/lib/utils";
import type { PatientQueueItem } from "@/types/pharmacy";
import { PatientProfilePopup } from "@/features/patient-profile/PatientProfilePopup";
import { stageDotStyles, stageLabel, stageStyles } from "@/features/queue/queue-ui";
import { MachineStockCheck } from "./MachineStockCheck";

export function PatientPanel({ patient, onClose }: { patient: PatientQueueItem; onClose: () => void }) {
  const [hasRequestedStockCheck, setHasRequestedStockCheck] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const { data: stockCheck, isFetching: isCheckingStock } = useQuery({
    queryKey: ["machine-stock-check", patient.id],
    queryFn: () => getMachineStockCheck(patient),
    enabled: hasRequestedStockCheck,
  });

  function requestStockCheck() {
    setHasRequestedStockCheck(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/25 backdrop-blur-[1px]">
      <button aria-label="ปิดแผงข้อมูลผู้ป่วย" className="hidden flex-1 cursor-default lg:block" onClick={onClose} type="button" />
      <div className="flex h-full w-full justify-end gap-3 p-0 sm:p-3 lg:w-auto">
      {isProfileOpen ? <PatientProfilePopup patient={patient} onClose={() => setIsProfileOpen(false)} /> : null}
      <aside className="h-full w-full overflow-y-auto border-l border-slate-200 bg-white shadow-2xl shadow-slate-900/20 sm:max-w-[520px] sm:rounded-2xl sm:border">
      <div className="flex items-start justify-between border-b border-slate-100 p-5">
        <div>
          <h2 className="text-xl font-black text-slate-950">{patient.name}</h2>
          <p className="mt-2 text-sm font-bold text-slate-400">VN {patient.vn} · HN {patient.hn}</p>
          <div className="mt-4 flex gap-2">
            <Badge className={stageStyles[patient.stage]}>
              <span className={cn("mr-2 h-2 w-2 rounded-full", stageDotStyles[patient.stage])} />
              {stageLabel(patient.stage)}
            </Badge>
            <Badge className="bg-violet-100 text-violet-700"><Pill className="h-3.5 w-3.5" /></Badge>
          </div>
        </div>
        <Button onClick={onClose} size="icon" variant="ghost"><X className="h-5 w-5" /></Button>
      </div>

      <div className="space-y-6 p-5">
        <Button className="h-12 w-full" onClick={() => setIsProfileOpen(true)} variant="secondary">
          <UserRound className="h-5 w-5" />
          ดูโปรไฟล์
        </Button>

        <section>
          <div className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-[0.12em] text-slate-400">
            <AlertTriangle className="h-4 w-4" />
            Issues Detected
          </div>
          <div className="rounded-2xl border border-violet-200 bg-violet-100 p-4 text-violet-900 shadow-sm">
            <div className="flex items-start gap-3">
              <Pill className="mt-1 h-4 w-4 text-violet-600" />
              <div>
                <div className="font-black">{patient.issue?.title ?? "No Critical Issue"}</div>
                <div className="mt-2 text-sm font-medium text-violet-800">{patient.issue?.detail ?? "ยังไม่พบ alert สำคัญในรายการนี้"}</div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-sm font-black text-slate-500">รายการยา ({patient.drugs.length})</h3>
          <div className="space-y-3">
            {patient.drugs.map((drug) => (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" key={drug.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                      <Boxes className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-black text-slate-950">{drug.name}</div>
                      <div className="mt-1 text-sm font-semibold text-slate-500">{drug.sig}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black text-indigo-500">{drug.source}</div>
                    <div className="mt-1 text-xs font-bold text-slate-400">{drug.machineCode}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <Button className="h-14 w-full border-dashed border-blue-200 text-blue-700" disabled={isCheckingStock} onClick={requestStockCheck} variant="outline">
          <Search className="h-5 w-5" />
          {isCheckingStock ? "กำลังตรวจสอบเครื่องและสต็อก" : "ตรวจสอบเครื่องและสต็อก"}
        </Button>

        {hasRequestedStockCheck ? <MachineStockCheck stockCheck={stockCheck} isLoading={isCheckingStock} /> : null}
      </div>
    </aside>
    </div>
    </div>
  );
}
