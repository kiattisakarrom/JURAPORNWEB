"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PatientQueueItem } from "@/types/pharmacy";
import { alertIcon, alertStyles, durationClass, priorityStyles, stageLabel, stageStyles } from "./queue-ui";

function handleKeyboardActivate(event: React.KeyboardEvent, action: () => void) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    action();
  }
}

export function MobileQueueList({
  patients,
  selectedId,
  onSelect,
}: {
  patients: PatientQueueItem[];
  selectedId?: string;
  onSelect: (id: string, prescriptionId?: string) => void;
}) {
  const [expandedVn, setExpandedVn] = useState<string | null>(null);

  function toggleExpanded(vn: string) {
    setExpandedVn((current) => current === vn ? null : vn);
  }

  return (
    <div className="h-full space-y-3 overflow-y-auto p-4 md:hidden">
      {patients.length === 0 ? <div className="py-8 text-center text-sm font-bold text-slate-400">ไม่พบข้อมูลผู้ป่วย</div> : null}
      {patients.map((patient) => {
        const prescriptions = patient.prescriptions ?? [];
        const hasPrescriptions = prescriptions.length > 0;
        const isExpanded = expandedVn === patient.vn;
        const isSelected = selectedId === patient.id;
        const activateCard = () => hasPrescriptions ? toggleExpanded(patient.vn) : onSelect(patient.id);

        return (
          <article className={cn("overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm", (isSelected || isExpanded) && "border-blue-300 bg-blue-50")} key={patient.id}>
            <div
              aria-expanded={hasPrescriptions ? isExpanded : undefined}
              className="w-full cursor-pointer p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
              onClick={activateCard}
              onKeyDown={(event) => handleKeyboardActivate(event, activateCard)}
              role="button"
              tabIndex={0}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-mono text-sm font-black text-blue-700">VN {patient.vn}</div>
                  <div className="mt-1 text-base font-black text-slate-800">{patient.name}</div>
                  <div className="mt-1 font-mono text-xs font-bold text-slate-400">HN {patient.hn}</div>
                </div>
                <span className={cn("text-sm font-black", priorityStyles[patient.priority])}>{patient.priority}</span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs font-bold text-slate-400">จำนวน PN</div>
                  <div className="mt-1 font-black text-blue-700">{prescriptions.length} PN</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-400">จำนวนรายการยา</div>
                  <div className="mt-1 font-black text-slate-600">{patient.medicationCount} รายการ</div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {patient.alerts.length ? patient.alerts.map((alert) => (
                    <span className={cn("flex h-8 w-8 items-center justify-center rounded-xl", alertStyles[alert])} key={alert}>{alertIcon(alert)}</span>
                  )) : <span className="text-sm font-bold text-slate-300">ไม่มีแจ้งเตือน</span>}
                </div>
                <span className="flex shrink-0 items-center gap-1 text-sm font-bold text-blue-600">
                  {hasPrescriptions ? (isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : null}
                  {hasPrescriptions ? (isExpanded ? "ซ่อน PN" : "ดู PN") : patient.pharmacist ?? "เปิดรายการ"}
                </span>
              </div>
            </div>

            {hasPrescriptions && isExpanded ? (
              <div className="space-y-2 border-t border-blue-100 bg-[#f6f9ff] p-3">
                <div className="px-1 pb-1 font-mono text-xs font-black text-blue-800">VN {patient.vn} — {patient.name}</div>
                {prescriptions.map((prescription) => {
                  const selectRow = () => onSelect(patient.id, prescription.id);

                  return (
                    <div
                      className={cn(
                        "cursor-pointer rounded-xl border border-blue-100 bg-white p-3 transition hover:border-blue-300 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                        isSelected && "border-blue-300 bg-blue-50",
                      )}
                      key={prescription.id}
                      onClick={selectRow}
                      onKeyDown={(event) => handleKeyboardActivate(event, selectRow)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-mono text-sm font-black text-blue-700">PN {prescription.pn}</div>
                          <div className="mt-1 text-xs font-bold text-slate-400">{prescription.time} · {prescription.drugs.length} รายการ</div>
                        </div>
                        <Badge className={cn("w-fit shrink-0 whitespace-nowrap", stageStyles[prescription.stage])}>{stageLabel(prescription.stage)}</Badge>
                      </div>

                      <div className="mt-3 flex items-end justify-between gap-3">
                        <div className="flex flex-wrap gap-2">
                          {prescription.alerts.length ? prescription.alerts.map((alert) => (
                            <span className={cn("flex h-8 w-8 items-center justify-center rounded-xl", alertStyles[alert])} key={alert}>{alertIcon(alert)}</span>
                          )) : <span className="text-xs font-bold text-slate-300">ไม่มีแจ้งเตือน</span>}
                        </div>
                        <div className="text-right text-xs font-bold text-slate-500">
                          <div>{patient.doctor ?? "รอข้อมูลแพทย์"}</div>
                          <div className={cn("mt-1", durationClass(patient.durationMinutes))}>{patient.durationMinutes}m · {patient.priority}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
