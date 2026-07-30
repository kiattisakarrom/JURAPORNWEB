"use client";

import { useState } from "react";
import { LockKeyhole } from "lucide-react";
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
  sentToMatchingPatientIds,
  verifiedPrescriptionIds,
  onSelect,
  onSendMatching,
}: {
  patients: PatientQueueItem[];
  selectedId?: string;
  sentToMatchingPatientIds: ReadonlySet<string>;
  verifiedPrescriptionIds: ReadonlySet<string>;
  onSelect: (id: string, prescriptionId?: string) => void;
  onSendMatching: (patientId: string) => void;
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
        const allPrescriptionsVerified = hasPrescriptions && prescriptions.every((prescription) => verifiedPrescriptionIds.has(prescription.id));
        const hasSentToMatching = sentToMatchingPatientIds.has(patient.id);
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
                  <span className={cn("text-sm font-black", priorityStyles[patient.priority])}>{patient.priority}</span>
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
                <div onClick={(event) => event.stopPropagation()}>
                  {hasPrescriptions ? (
                    <Button
                      aria-label={hasSentToMatching ? "Verify VN แล้ว" : allPrescriptionsVerified ? "Verify VN" : "ยัง Verify VN ไม่ได้ ต้อง Verify PN ทุกใบก่อน"}
                      className={cn(
                        "h-9 rounded-xl px-3",
                        allPrescriptionsVerified
                          ? "bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-100 disabled:text-blue-700 disabled:opacity-100"
                          : "border border-slate-300 bg-slate-100 text-slate-400 shadow-none disabled:pointer-events-auto disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-100",
                      )}
                      disabled={!allPrescriptionsVerified || hasSentToMatching}
                      onClick={() => onSendMatching(patient.id)}
                      title={hasSentToMatching ? "Verify VN แล้ว" : allPrescriptionsVerified ? "Verify VN" : "ต้อง Verify PN ทุกใบก่อน"}
                      type="button"
                    >
                      {!allPrescriptionsVerified ? <LockKeyhole className="h-3.5 w-3.5" /> : null}
                      {hasSentToMatching ? "Verify แล้ว" : "Verify"}
                    </Button>
                  ) : <span className="text-sm font-bold text-slate-400">{patient.pharmacist ?? "ไม่มี PN"}</span>}
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
                          <div>{patient.doctor ?? "รอข้อมูลแพทย์"}</div>
                          <div className={cn("mt-1", durationClass(patient.durationMinutes))}>{patient.durationMinutes}m · {patient.priority}</div>
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
