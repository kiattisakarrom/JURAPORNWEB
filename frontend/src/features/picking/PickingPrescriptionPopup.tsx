"use client";

import { PackageOpen, Pill, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClinicalAlertBadges } from "@/features/queue/ClinicalAlertBadges";
import { stageDotStyles, stageLabel, stageStyles } from "@/features/queue/queue-ui";
import { cn } from "@/lib/utils";
import type { DrugItem, PatientQueueItem } from "@/types/pharmacy";

export function PickingPrescriptionPopup({
  patient,
  prescriptionNumber,
  onClose,
}: {
  patient: PatientQueueItem;
  prescriptionNumber: string;
  onClose: () => void;
}) {
  return (
    <div aria-modal="true" className="fixed inset-0 z-50 flex h-dvh justify-end bg-slate-950/25 backdrop-blur-[1px]" role="dialog">
      <button aria-label="ปิดรายละเอียด PN" className="hidden flex-1 cursor-default lg:block" onClick={onClose} type="button" />
      <aside className="relative flex h-full w-full flex-col overflow-hidden border-l border-slate-200 bg-[#f6f8fb] shadow-2xl sm:m-3 sm:h-[calc(100%-24px)] sm:rounded-2xl sm:border lg:max-w-4xl">
        <header className="shrink-0 border-b border-slate-200 bg-white px-5 py-4 pr-16">
          <div className="flex flex-wrap items-center gap-2">
            <PackageOpen className="h-5 w-5 text-violet-600" />
            <h2 className="text-xl font-black text-slate-950">รายการยา PN {prescriptionNumber}</h2>
            <Badge className={stageStyles[patient.stage]}>
              <span className={cn("mr-2 h-2 w-2 rounded-full", stageDotStyles[patient.stage])} />
              {stageLabel(patient.stage)}
            </Badge>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-bold text-slate-500">
            <span>VN {patient.vn}</span>
            <span>HN {patient.hn}</span>
            <span>{patient.name}</span>
            <span>{patient.drugs.length} รายการ</span>
          </div>
        </header>

        <Button aria-label="ปิด" className="absolute right-4 top-4 z-10 bg-white shadow-sm" onClick={onClose} size="icon" variant="ghost">
          <X className="h-5 w-5" />
        </Button>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
          {patient.drugs.map((drug, index) => (
            <DrugCard drug={drug} index={index} key={drug.id} />
          ))}
          {patient.drugs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-bold text-slate-400">
              ไม่พบรายการยาใน PN นี้
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function DrugCard({ drug, index }: { drug: DrugItem; index: number }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 font-black text-violet-700">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Pill className="h-4 w-4 text-orange-500" />
            <h3 className="font-black text-slate-950">{drug.name}</h3>
            <span className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-xs font-black text-slate-500">
              {drug.MEDICINECODE ?? "—"}
            </span>
          </div>
          <p className="mt-2 whitespace-pre-line text-sm font-semibold leading-6 text-slate-500">
            {drug.DOSEMEMO_TH?.trim() || drug.sig}
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <ClinicalAlertBadges
              alerts={Array.from(new Set(drug.clinicalAlerts?.map((alert) => alert.kind) ?? []))}
              clinicalAlerts={drug.clinicalAlerts}
              emptyLabel="ไม่มีแจ้งเตือน"
            />
            <span className="text-sm font-black text-slate-700">
              {formatQuantity(drug.orderQuantity, drug.orderUnitCode)}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

function formatQuantity(quantity?: number | null, unit?: string | null) {
  const quantityText = quantity === null || quantity === undefined ? "—" : new Intl.NumberFormat("th-TH").format(quantity);
  return [quantityText, unit?.trim()].filter(Boolean).join(" ");
}
