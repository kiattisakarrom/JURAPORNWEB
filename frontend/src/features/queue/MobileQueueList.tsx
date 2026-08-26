"use client";

import { useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PatientQueueItem } from "@/types/pharmacy";
import { alertIcon, alertStyles, durationClass, priorityStyles, stageLabel, stageStyles } from "./queue-ui";
import { VerifyStatusCheckbox } from "./VerifyStatusCheckbox";

function handleKeyboardActivate(event: React.KeyboardEvent, action: () => void) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    action();
  }
}

export function MobileQueueList({
  patients,
  selectedId,
  verifiedPrescriptionIds,
  onSelect,
  onPendingAction,
  onPrimaryAction,
}: {
  patients: PatientQueueItem[];
  selectedId?: string;
  verifiedPrescriptionIds: ReadonlySet<string>;
  onSelect: (id: string, prescriptionId?: string) => void;
  onPendingAction: (patient: PatientQueueItem) => void;
  onPrimaryAction: (patient: PatientQueueItem) => void;
}) {
  const [expandedVn, setExpandedVn] = useState<string | null>(null);

  function toggleExpanded(vn: string) {
    setExpandedVn((current) => current === vn ? null : vn);
  }

  return (
    <div className="h-full space-y-3 overflow-y-auto p-4 md:hidden" data-verify-scroll-container>
      {patients.length === 0 ? <div className="py-8 text-center text-sm font-bold text-slate-400">ไม่พบข้อมูลผู้ป่วย</div> : null}
      {patients.map((patient) => {
        const prescriptions = patient.prescriptions ?? [];
        const hasPrescriptions = prescriptions.length > 0;
        const isExpanded = expandedVn === patient.vn;
        const isSelected = selectedId === patient.id;
        const canSendToMatching = patient.workflowAllowedActions?.includes("SEND_TO_MATCHING") ?? false;
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
                <div className="shrink-0 text-right">
                  <span className={cn("text-sm font-black", priorityStyles[patient.priority])}>{priorityLabel(patient.priority)}</span>
                  <div className="mt-1 text-[11px] font-bold text-slate-400">วันที่ {patient.date ?? "—"}</div>
                </div>
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
                <div className="flex flex-wrap justify-end gap-2" onClick={(event) => event.stopPropagation()}>
                  {patient.stage === "verify" || patient.stage === "picking" ? (
                    <Button
                      aria-label={patient.stage === "picking" ? "ส่ง Matching" : "เปิดรายการยาเพื่อ Verify"}
                      className={cn(
                        "h-9 rounded-xl px-3",
                        "bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:opacity-100",
                      )}
                      disabled={patient.stage === "verify" ? !hasPrescriptions : !canSendToMatching}
                      onClick={() => onPrimaryAction(patient)}
                      title={patient.stage === "picking" ? "ส่งไป Matching" : "เปิด PN ที่ยังต้องตรวจ"}
                      type="button"
                    >
                      {patient.stage === "picking" ? "ส่ง Matching" : "เปิดตรวจยา"}
                    </Button>
                  ) : null}
                  {patient.stage === "verify" || patient.stage === "pending" ? (
                    <Button
                      className={patient.stage === "pending" ? "border-blue-200 bg-blue-50 text-blue-700" : "border-amber-200 bg-amber-50 text-amber-700"}
                      onClick={() => onPendingAction(patient)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <ArrowLeftRight className="h-3.5 w-3.5" />
                      {patient.stage === "pending" ? "กลับ Verify" : "ส่ง Pending"}
                    </Button>
                  ) : null}
                </div>
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
                          <div className="mt-1 text-xs font-bold text-slate-400">
                            วันที่ {prescription.date ?? patient.date ?? "—"} · {prescription.time} · {prescription.drugs.length} รายการ
                          </div>
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
                          <div>{prescription.doctor ?? patient.doctor ?? "รอข้อมูลแพทย์"}</div>
                          <div className={cn("mt-1", durationClass(patient.durationMinutes))}>{formatDuration(patient.durationMinutes)} · {priorityLabel(patient.priority)}</div>
                          <span className="mt-2 inline-flex items-center gap-1.5 text-blue-700">
                            เช็ก
                            <VerifyStatusCheckbox
                              checked={verifiedPrescriptionIds.has(prescription.id)}
                              label={`สถานะ Verify PN ${prescription.pn}`}
                            />
                          </span>
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

function priorityLabel(priority: PatientQueueItem["priority"]) {
  return priority === "Unspecified" ? "—" : priority;
}

function formatDuration(minutes?: number) {
  return minutes === undefined ? "—" : `${minutes}m`;
}
