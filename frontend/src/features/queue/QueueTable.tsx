"use client";

import { Fragment, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PatientPrescription, PatientQueueItem } from "@/types/pharmacy";
import { alertIcon, alertStyles, durationClass, priorityStyles, stageDotStyles, stageLabel, stageStyles } from "./queue-ui";
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
  selectedId,
  onSelect,
}: {
  patient: PatientQueueItem;
  prescription: PatientPrescription;
  isVerified: boolean;
  selectedId?: string;
  onSelect: (id: string, prescriptionId?: string) => void;
}) {
  const selectRow = () => onSelect(patient.id, prescription.id);

  return (
    <div
      className={cn(
        "grid cursor-pointer grid-cols-[110px_120px_100px_116px_150px_76px_130px_90px_minmax(200px,1fr)_88px] items-center gap-3 px-4 py-3 transition hover:bg-blue-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500",
        selectedId === patient.id && "bg-blue-50",
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
      <Badge className={cn("w-fit justify-self-start whitespace-nowrap", stageStyles[prescription.stage])}>
        <span className={cn("mr-2 h-2 w-2 rounded-full", stageDotStyles[prescription.stage])} />
        {stageLabel(prescription.stage)}
      </Badge>
      <span className="flex gap-2">
        {prescription.alerts.length ? prescription.alerts.map((alert) => (
          <span className={cn("flex h-[30px] w-[30px] items-center justify-center rounded-[10px]", alertStyles[alert])} key={alert}>{alertIcon(alert)}</span>
        )) : <span className="text-sm font-bold text-slate-300">ไม่มี</span>}
      </span>
      <span className="font-mono text-xs font-bold text-slate-400">{prescription.time}</span>
      <span className="text-sm font-bold text-slate-600">{prescription.drugs.length} รายการ</span>
      <span className={cn("font-mono text-sm font-bold", durationClass(patient.durationMinutes))}>{formatDuration(patient.durationMinutes)}</span>
      <span className="truncate text-sm font-bold text-slate-600">{prescription.doctor ?? patient.doctor ?? "รอข้อมูลแพทย์"}</span>
      <VerifyStatusCheckbox checked={isVerified} label={`สถานะ Verify PN ${prescription.pn}`} />
    </div>
  );
}

export function QueueTable({
  patients,
  selectedId,
  isLoading,
  sentToMatchingPatientIds,
  verifiedPrescriptionIds,
  onSelect,
  onSendMatching,
}: {
  patients: PatientQueueItem[];
  selectedId?: string;
  isLoading: boolean;
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
    <div className="stable-scrollbar hidden h-full min-h-0 overflow-auto md:block" data-verify-scroll-container>
      <table className="w-full min-w-[1360px] table-fixed border-collapse text-left">
        <colgroup>
          <col className="w-[126px]" />
          <col className="w-[120px]" />
          <col className="w-[132px]" />
          <col className="w-[132px]" />
          <col className="w-[220px]" />
          <col className="w-[116px]" />
          <col className="w-[168px]" />
          <col className="w-[170px]" />
          <col className="w-[170px]" />
        </colgroup>
        <thead className="sticky top-0 z-20 border-b border-[#e6eaf0] bg-white text-[11px] font-bold uppercase tracking-[0.07em] text-[#9aa7b8] shadow-[0_1px_0_#e6eaf0]">
          <tr>
            {["Priority", "วันที่", "VN", "HN", "ชื่อ-นามสกุล", "จำนวน PN", "จำนวนรายการยา", "แจ้งเตือน", "เช็คลิส verify"].map((label) => (
              <th className="h-[42px] px-4" key={label}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {isLoading ? (
            <tr><td className="px-5 py-8 text-sm font-bold text-slate-400" colSpan={9}>กำลังโหลดข้อมูล...</td></tr>
          ) : patients.length === 0 ? (
            <tr><td className="px-5 py-8 text-sm font-bold text-slate-400" colSpan={9}>ไม่พบข้อมูลผู้ป่วย</td></tr>
          ) : patients.map((patient) => {
            const prescriptions = patient.prescriptions ?? [];
            const hasPrescriptions = prescriptions.length > 0;
            const isExpanded = expandedVn === patient.vn;
            const isSelected = selectedId === patient.id;
            const allPrescriptionsVerified = hasPrescriptions && prescriptions.every((prescription) => verifiedPrescriptionIds.has(prescription.id));
            const hasSentToMatching = sentToMatchingPatientIds.has(patient.id);
            const activateRow = () => hasPrescriptions ? toggleExpanded(patient.vn) : onSelect(patient.id);

            return (
              <Fragment key={patient.id}>
                <tr
                  aria-expanded={hasPrescriptions ? isExpanded : undefined}
                  className={cn(
                    "cursor-pointer transition hover:bg-[#f6f9ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500",
                    (isSelected || isExpanded) && "bg-[#f6f9ff]",
                  )}
                  onClick={activateRow}
                  onKeyDown={(event) => handleKeyboardActivate(event, activateRow)}
                  role="button"
                  tabIndex={0}
                >
                  <td className={cn("h-[66px] px-4 text-sm font-black", priorityStyles[patient.priority])}>
                    <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-current" />
                    {priorityLabel(patient.priority)}
                  </td>
                  <td className="px-4 font-mono text-xs font-bold text-slate-400">{patient.date ?? "—"}</td>
                  <td className="px-4 font-mono text-[15px] font-black text-[#2f6bf3]">{patient.vn}</td>
                  <td className="px-4 font-mono text-[14px] font-bold text-slate-500">{patient.hn}</td>
                  <td className="px-4 text-[15px] font-semibold text-[#22324a]">{patient.name}</td>
                  <td className="px-4 text-sm font-black text-blue-700">{prescriptions.length} PN</td>
                  <td className="px-4 text-sm font-semibold text-[#56657a]">{patient.medicationCount} รายการ</td>
                  <td className="px-4">
                    <div className="flex gap-2">
                      {patient.alerts.length ? patient.alerts.map((alert) => (
                        <span className={cn("flex h-[30px] w-[30px] items-center justify-center rounded-[10px]", alertStyles[alert])} key={alert}>{alertIcon(alert)}</span>
                      )) : <span className="text-sm font-bold text-slate-300">ไม่มี</span>}
                    </div>
                  </td>
                  <td className="px-4" onClick={(event) => event.stopPropagation()}>
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
                  </td>
                </tr>

                {hasPrescriptions && isExpanded ? (
                  <tr>
                    <td className="bg-[#f6f9ff] px-4 py-4" colSpan={9}>
                      <div className="overflow-x-auto rounded-2xl border border-blue-100 bg-white shadow-sm">
                        <div className="min-w-[1300px]">
                          <div className="border-b border-blue-100 bg-blue-50/70 px-4 py-3">
                            <div className="font-mono text-sm font-black text-blue-800">VN {patient.vn} — {patient.name}</div>
                          </div>
                          <div className="grid grid-cols-[110px_120px_100px_116px_150px_76px_130px_90px_minmax(200px,1fr)_88px] gap-3 border-b border-blue-100 bg-blue-50/40 px-4 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-blue-600">
                            {["Priority", "วันที่", "PN", "สถานะ", "แจ้งเตือน", "เวลา", "จำนวนรายการยา", "Duration", "ชื่อแพทย์", "เช็ก"].map((label) => <span key={label}>{label}</span>)}
                          </div>
                          <div className="divide-y divide-slate-100">
                            {prescriptions.map((prescription) => (
                              <PrescriptionRow
                                isVerified={verifiedPrescriptionIds.has(prescription.id)}
                                key={prescription.id}
                                onSelect={onSelect}
                                patient={patient}
                                prescription={prescription}
                                selectedId={selectedId}
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
