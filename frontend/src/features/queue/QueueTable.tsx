"use client";

import { Fragment, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PatientPrescription, PatientQueueItem } from "@/types/pharmacy";
import { ClinicalAlertBadges } from "./ClinicalAlertBadges";
import { durationClass, priorityStyles, stageDotStyles, stageLabel, stageStyles } from "./queue-ui";
import { VerifyStatusCheckbox } from "./VerifyStatusCheckbox";

function handleKeyboardActivate(event: React.KeyboardEvent, action: () => void) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    action();
  }
}

function PrescriptionRow({
  patient,
  prescription,
  isVerified,
  selectedPrescriptionId,
  onSelect,
}: {
  patient: PatientQueueItem;
  prescription: PatientPrescription;
  isVerified: boolean;
  selectedPrescriptionId?: string;
  onSelect: (id: string, prescriptionId?: string) => void;
}) {
  const selectRow = () => onSelect(patient.id, prescription.id);

  return (
    <div
      className={cn(
        "grid cursor-pointer grid-cols-[110px_120px_100px_116px_150px_76px_130px_90px_minmax(200px,1fr)_88px] items-center gap-3 px-4 py-3 text-center transition hover:bg-blue-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500",
        selectedPrescriptionId === prescription.id && "bg-blue-50 ring-1 ring-inset ring-blue-200",
      )}
      onClick={selectRow}
      onKeyDown={(event) => handleKeyboardActivate(event, selectRow)}
      role="button"
      tabIndex={0}
    >
      <span className={cn("text-sm font-black", priorityStyles[patient.priority])}>
        <span className="mr-2 inline-block h-2 w-2 rounded-full bg-current" />
        {priorityLabel(patient.priority)}
      </span>
      <span className="font-mono text-xs font-bold text-slate-400">{prescription.date ?? patient.date ?? "—"}</span>
      <span className="font-mono text-sm font-black text-blue-700">{prescription.pn}</span>
      <Badge className={cn("w-fit justify-self-center whitespace-nowrap", stageStyles[prescription.stage])}>
        <span className={cn("mr-2 h-2 w-2 rounded-full", stageDotStyles[prescription.stage])} />
        {stageLabel(prescription.stage)}
      </Badge>
      <span className="flex justify-center">
        <ClinicalAlertBadges alerts={prescription.alerts} clinicalAlerts={prescription.clinicalAlerts} />
      </span>
      <span className="font-mono text-xs font-bold text-slate-400">{prescription.time}</span>
      <span className="text-sm font-bold text-slate-600">{prescription.drugs.length} รายการ</span>
      <span className={cn("font-mono text-sm font-bold", durationClass(patient.durationMinutes))}>{formatDuration(patient.durationMinutes)}</span>
      <span className="truncate text-sm font-bold text-slate-600">{prescription.doctor ?? patient.doctor ?? "รอข้อมูลแพทย์"}</span>
      {prescription.stage === "verify" ? (
        <span className="flex justify-center">
          <VerifyStatusCheckbox checked={isVerified} label={`สถานะ Verify PN ${prescription.pn}`} />
        </span>
      ) : (
        <span className="text-xs font-bold text-slate-400">{stageLabel(prescription.stage)}</span>
      )}
    </div>
  );
}

export function QueueTable({
  patients,
  selectedId,
  selectedPrescriptionId,
  isLoading,
  verifiedPrescriptionIds,
  onSelect,
  onPendingAction,
  onSendMatching,
}: {
  patients: PatientQueueItem[];
  selectedId?: string;
  selectedPrescriptionId?: string;
  isLoading: boolean;
  verifiedPrescriptionIds: ReadonlySet<string>;
  onSelect: (id: string, prescriptionId?: string) => void;
  onPendingAction: (patient: PatientQueueItem) => void;
  onSendMatching: (patient: PatientQueueItem) => void;
}) {
  const [expandedPatientId, setExpandedPatientId] = useState<string | null>(null);

  function toggleExpanded(patientId: string) {
    setExpandedPatientId((current) => current === patientId ? null : patientId);
  }

  return (
    <div className="stable-scrollbar hidden h-full min-h-0 overflow-auto md:block" data-verify-scroll-container>
      <table className="w-full min-w-[1590px] table-fixed border-collapse text-center">
        <colgroup>
          <col className="w-[126px]" />
          <col className="w-[66px]" />
          <col className="w-[120px]" />
          <col className="w-[80px]" />
          <col className="w-[132px]" />
          <col className="w-[220px]" />
          <col className="w-[116px]" />
          <col className="w-[168px]" />
          <col className="w-[102px]" />
          <col className="w-[150px]" />
          <col className="w-[160px]" />
          <col className="w-[170px]" />
        </colgroup>
        <thead className="sticky top-0 z-20 border-b border-[#e6eaf0] bg-white text-[16px] font-bold uppercase leading-tight tracking-[0.03em] text-[#9aa7b8] shadow-[0_1px_0_#e6eaf0]">
          <tr>
            {["Prio", "คิวที่", "วันที่", "VN", "HN", "ชื่อ-นามสกุล", "จำนวน PN", "รายการยา", "แจ้งเตือน", "สถานะ", "Pending", "การทำงาน"].map((label) => (
              <th className="h-[64px] px-2 text-center" key={label}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {isLoading ? (
            <tr><td className="px-5 py-8 text-sm font-bold text-slate-400" colSpan={12}>กำลังโหลดข้อมูล...</td></tr>
          ) : patients.length === 0 ? (
            <tr><td className="px-5 py-8 text-sm font-bold text-slate-400" colSpan={12}>ไม่พบข้อมูลผู้ป่วย</td></tr>
          ) : patients.map((patient) => {
            const prescriptions = patient.prescriptions ?? [];
            const hasPrescriptions = prescriptions.length > 0;
            const canExpand = patient.stage !== "verify" ? hasPrescriptions : prescriptions.length > 1;
            const isExpanded = canExpand && expandedPatientId === patient.id;
            const isSelected = selectedId === patient.id;
            const canSendToMatching = patient.workflowAllowedActions?.includes("SEND_TO_MATCHING") ?? false;
            const activateRow = () => {
              if (!hasPrescriptions) return;
              if (patient.stage === "verify" && prescriptions.length === 1) {
                setExpandedPatientId(null);
                onSelect(patient.id, prescriptions[0].id);
                return;
              }
              toggleExpanded(patient.id);
            };

            return (
              <Fragment key={patient.id}>
                <tr
                  aria-disabled={!hasPrescriptions}
                  aria-expanded={canExpand ? isExpanded : undefined}
                  className={cn(
                    "transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500",
                    hasPrescriptions ? "cursor-pointer hover:bg-[#f6f9ff]" : "cursor-default",
                    (isSelected || isExpanded) && "bg-[#f6f9ff]",
                  )}
                  onClick={activateRow}
                  onKeyDown={(event) => handleKeyboardActivate(event, activateRow)}
                  role="button"
                  tabIndex={hasPrescriptions ? 0 : -1}
                >
                  <td className={cn("h-[66px] px-4 text-sm font-black", priorityStyles[patient.priority])}>
                    <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-current" />
                    {priorityLabel(patient.priority)}
                  </td>
                  <td aria-label="ยังไม่มีข้อมูลลำดับคิว" className="px-2" />
                  <td className="px-4 font-mono text-xs font-bold text-slate-400">{patient.date ?? "—"}</td>
                  <td className="px-2 font-mono text-[15px] font-black text-[#2f6bf3]">{patient.vn}</td>
                  <td className="px-4 font-mono text-[14px] font-bold text-slate-500">{patient.hn}</td>
                  <td className="px-4 text-[15px] font-semibold text-[#22324a]">
                    {patient.name}
                    {patient.verifyLock?.isLocked ? <div className="mt-1 text-xs font-medium text-amber-700">กำลัง Verify · {patient.verifyLock.ownerName ?? "ผู้ใช้อื่น"}</div> : null}
                    {patient.sourceChanged ? <div className="mt-1 text-xs font-medium text-amber-700">ข้อมูลใบยาต้นทางเปลี่ยนหลังสร้างแพ็กเกจ</div> : null}
                  </td>
                  <td className="px-4 text-sm font-black text-blue-700">{prescriptions.length} PN</td>
                  <td className="px-4 text-sm font-semibold text-[#56657a]">{patient.medicationCount} รายการ</td>
                  <td className="px-2">
                    <div className="flex justify-center">
                      <ClinicalAlertBadges alerts={patient.alerts} clinicalAlerts={patient.clinicalAlerts} />
                    </div>
                  </td>
                  <td className="px-4">
                    <Badge className={cn("mx-auto w-fit whitespace-nowrap", stageStyles[patient.stage])}>
                      <span className={cn("mr-2 h-2 w-2 rounded-full", stageDotStyles[patient.stage])} />
                      {stageLabel(patient.stage)}
                    </Badge>
                  </td>
                  <td className="px-4" onClick={(event) => event.stopPropagation()}>
                    {patient.stage === "verify" || patient.stage === "pending" ? (
                      <Button
                        className={cn(
                          "h-9 rounded-xl px-3",
                          patient.stage === "pending"
                            ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                            : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100",
                        )}
                        onClick={() => onPendingAction(patient)}
                        type="button"
                        variant="outline"
                      >
                        <ArrowLeftRight className="h-3.5 w-3.5" />
                        {patient.stage === "pending" ? "กลับ Verify" : "ส่ง Pending"}
                      </Button>
                    ) : <span className="text-sm font-bold text-slate-300">—</span>}
                  </td>
                  <td className="px-4" onClick={(event) => event.stopPropagation()}>
                    {patient.stage === "picking" ? (
                      <Button
                        aria-label="ส่งไป Matching"
                        className={cn(
                          "h-9 rounded-xl px-3",
                          "bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:opacity-100",
                        )}
                        disabled={!canSendToMatching}
                        onClick={() => onSendMatching(patient)}
                        title="ข้ามการรอ Location สำหรับ MVP และส่งไป Matching"
                        type="button"
                      >
                        ส่ง Matching
                      </Button>
                    ) : <span className="text-sm font-bold text-slate-300">—</span>}
                  </td>
                </tr>

                {hasPrescriptions && isExpanded ? (
                  <tr>
                    <td className="bg-[#f6f9ff] px-4 py-4" colSpan={12}>
                      <div className="overflow-x-auto rounded-2xl border border-blue-100 bg-white shadow-sm">
                        <div className="min-w-[1300px]">
                          <div className="border-b border-blue-100 bg-blue-50/70 px-4 py-3">
                            <div className="font-mono text-sm font-black text-blue-800">VN {patient.vn} — {patient.name}</div>
                          </div>
                          <div className="grid grid-cols-[110px_120px_100px_116px_150px_76px_130px_90px_minmax(200px,1fr)_88px] gap-3 border-b border-blue-100 bg-blue-50/40 px-4 py-2 text-center text-[10px] font-black uppercase tracking-[0.08em] text-blue-600">
                            {["Prio", "วันที่", "PN", "สถานะ", "แจ้งเตือน", "เวลา", "รายการยา", "Duration", "ชื่อแพทย์", "เช็ก"].map((label) => <span key={label}>{label}</span>)}
                          </div>
                          <div className="divide-y divide-slate-100">
                            {prescriptions.map((prescription) => (
                              <PrescriptionRow
                                isVerified={verifiedPrescriptionIds.has(prescription.id)}
                                key={prescription.id}
                                onSelect={onSelect}
                                patient={patient}
                                prescription={prescription}
                                selectedPrescriptionId={selectedPrescriptionId}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function priorityLabel(priority: PatientQueueItem["priority"]) {
  return priority === "Unspecified" ? "—" : priority;
}

function formatDuration(minutes?: number) {
  return minutes === undefined ? "—" : `${minutes}m`;
}
