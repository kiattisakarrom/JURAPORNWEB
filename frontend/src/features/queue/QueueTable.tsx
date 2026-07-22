"use client";

import { ChevronDown, ChevronRight, FileText } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PatientPrescription, PatientQueueItem } from "@/types/pharmacy";
import { groupPatientsByHn } from "./queue-groups";
import { alertIcon, alertStyles, durationClass, priorityStyles, stageDotStyles, stageLabel, stageStyles } from "./queue-ui";

function handleKeyboardActivate(event: React.KeyboardEvent, action: () => void) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    action();
  }
}

function PrescriptionRow({ visit, prescription, selectedId, onSelect }: {
  visit: PatientQueueItem;
  prescription?: PatientPrescription;
  selectedId?: string;
  onSelect: (id: string, prescriptionId?: string) => void;
}) {
  const pn = prescription ? `PN-${visit.vn}-${prescription.pn}` : "—";
  const alerts = prescription?.alerts ?? visit.alerts;
  const medicationCount = prescription?.drugs.length ?? visit.medicationCount;
  const time = prescription?.time ?? visit.time;
  const selectRow = () => onSelect(visit.id, prescription?.id);

  return (
    <div
      className={cn(
        "grid cursor-pointer grid-cols-[110px_96px_160px_116px_100px_150px_76px_90px_minmax(180px,1fr)] items-center gap-3 px-4 py-3 transition hover:bg-blue-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500",
        selectedId === visit.id && "bg-blue-50",
      )}
      onClick={selectRow}
      onKeyDown={(event) => handleKeyboardActivate(event, selectRow)}
      role="button"
      tabIndex={0}
    >
      <span className={cn("text-sm font-black", priorityStyles[visit.priority])}>
        <span className="mr-2 inline-block h-2 w-2 rounded-full bg-current" />
        {visit.priority}
      </span>
      <span className="font-mono text-sm font-bold text-[#15233b]">{visit.vn}</span>
      <span className="flex items-center gap-2 font-mono text-sm font-black text-blue-700">
        <FileText className="h-4 w-4 shrink-0" />
        {pn}
      </span>
      <Badge className={stageStyles[visit.stage]}>
        <span className={cn("mr-2 h-2 w-2 rounded-full", stageDotStyles[visit.stage])} />
        {stageLabel(visit.stage)}
      </Badge>
      <span className="text-sm font-bold text-slate-600">{medicationCount} รายการ</span>
      <span className="flex gap-2">
        {alerts.length ? alerts.map((alert) => (
          <span className={cn("flex h-[30px] w-[30px] items-center justify-center rounded-[10px]", alertStyles[alert])} key={alert}>{alertIcon(alert)}</span>
        )) : <span className="text-sm font-bold text-slate-300">ไม่มี</span>}
      </span>
      <span className="font-mono text-xs font-bold text-slate-400">{time}</span>
      <span className={cn("font-mono text-sm font-bold", durationClass(visit.durationMinutes))}>{visit.durationMinutes}m</span>
      <span className="truncate text-sm font-bold text-slate-600">{visit.doctor ?? "รอข้อมูลแพทย์"}</span>
    </div>
  );
}

export function QueueTable({ patients, selectedId, isLoading, onSelect }: {
  patients: PatientQueueItem[];
  selectedId?: string;
  isLoading: boolean;
  onSelect: (id: string, prescriptionId?: string) => void;
}) {
  const patientGroups = useMemo(() => groupPatientsByHn(patients), [patients]);
  const [expandedHns, setExpandedHns] = useState<Set<string>>(() => new Set());

  function toggleExpanded(hn: string) {
    setExpandedHns((current) => {
      const next = new Set(current);
      if (next.has(hn)) next.delete(hn);
      else next.add(hn);
      return next;
    });
  }

  return (
    <div className="stable-scrollbar hidden h-full min-h-0 overflow-auto md:block">
      <table className="w-full min-w-[1120px] table-fixed border-collapse text-left">
        <colgroup>
          <col className="w-[126px]" />
          <col className="w-[108px]" />
          <col className="w-[136px]" />
          <col className="w-[230px]" />
          <col className="w-[230px]" />
          <col className="w-[170px]" />
          <col className="w-[170px]" />
        </colgroup>
        <thead className="sticky top-0 z-20 border-b border-[#e6eaf0] bg-white text-[11px] font-bold uppercase tracking-[0.07em] text-[#9aa7b8] shadow-[0_1px_0_#e6eaf0]">
          <tr>
            {["Priority", "จำนวน VN", "HN", "ชื่อ-นามสกุล", "จำนวน PN / รายการยาทั้งหมด", "แจ้งเตือน", "การทำงาน"].map((label) => (
              <th className="h-[42px] px-4" key={label}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {isLoading ? (
            <tr><td className="px-5 py-8 text-sm font-bold text-slate-400" colSpan={7}>กำลังโหลดข้อมูล...</td></tr>
          ) : patientGroups.length === 0 ? (
            <tr><td className="px-5 py-8 text-sm font-bold text-slate-400" colSpan={7}>ไม่พบข้อมูลผู้ป่วย</td></tr>
          ) : patientGroups.map((group) => {
            const isExpanded = expandedHns.has(group.hn);
            const hasSelectedVisit = group.visits.some((visit) => visit.id === selectedId);
            const toggleGroup = () => toggleExpanded(group.hn);

            return (
              <Fragment key={group.hn}>
                <tr
                  aria-expanded={isExpanded}
                  className={cn(
                    "cursor-pointer transition hover:bg-[#f6f9ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500",
                    (hasSelectedVisit || isExpanded) && "bg-[#f6f9ff]",
                  )}
                  onClick={toggleGroup}
                  onKeyDown={(event) => handleKeyboardActivate(event, toggleGroup)}
                  role="button"
                  tabIndex={0}
                >
                  <td className={cn("h-[66px] px-4 text-sm font-black", priorityStyles[group.priority])}>
                    <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-current" />
                    {group.priority}
                  </td>
                  <td className="px-4 text-sm font-black text-[#2f6bf3]">{group.visits.length} VN</td>
                  <td className="px-4 font-mono text-[15px] font-bold text-[#15233b]">{group.hn}</td>
                  <td className="px-4 text-[15px] font-semibold text-[#22324a]">{group.name}</td>
                  <td className="px-4 text-sm font-semibold text-[#56657a]">
                    <span className="font-black text-blue-700">{group.prescriptionCount} PN</span>
                    <span className="mx-2 text-slate-300">/</span>
                    {group.medicationCount} รายการ
                  </td>
                  <td className="px-4">
                    <div className="flex gap-2">
                      {group.alerts.length ? group.alerts.map((alert) => (
                        <span className={cn("flex h-[30px] w-[30px] items-center justify-center rounded-[10px]", alertStyles[alert])} key={alert}>{alertIcon(alert)}</span>
                      )) : <span className="text-sm font-bold text-slate-300">ไม่มี</span>}
                    </div>
                  </td>
                  <td className="px-4">
                    <span className="flex items-center gap-1.5 text-sm font-black text-blue-600">
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      {isExpanded ? "ซ่อนรายละเอียด" : "ดู VN / PN"}
                    </span>
                  </td>
                </tr>

                {isExpanded ? (
                  <tr>
                    <td className="bg-[#f6f9ff] px-4 py-4" colSpan={7}>
                      <div className="overflow-x-auto rounded-2xl border border-blue-100 bg-white shadow-sm">
                        <div className="min-w-[1250px]">
                          <div className="grid grid-cols-[110px_96px_160px_116px_100px_150px_76px_90px_minmax(180px,1fr)] gap-3 border-b border-blue-100 bg-blue-50/70 px-4 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-blue-600">
                            {["Priority", "VN", "PN", "สถานะ", "รายการยา", "แจ้งเตือน", "เวลา", "Duration", "ชื่อแพทย์"].map((label) => <span key={label}>{label}</span>)}
                          </div>
                          <div className="divide-y divide-slate-100">
                            {group.visits.flatMap((visit) => {
                              const prescriptions = visit.prescriptions ?? [];
                              if (prescriptions.length === 0) {
                                return [<PrescriptionRow key={visit.id} onSelect={onSelect} selectedId={selectedId} visit={visit} />];
                              }

                              return prescriptions.map((prescription) => (
                                <PrescriptionRow key={prescription.id} onSelect={onSelect} prescription={prescription} selectedId={selectedId} visit={visit} />
                              ));
                            })}
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
