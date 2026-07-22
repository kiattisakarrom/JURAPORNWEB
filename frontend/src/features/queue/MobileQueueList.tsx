"use client";

import { ChevronDown, ChevronRight, FileText } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PatientQueueItem } from "@/types/pharmacy";
import { groupPatientsByHn } from "./queue-groups";
import { alertIcon, alertStyles, durationClass, priorityStyles, stageLabel, stageStyles } from "./queue-ui";

function handleKeyboardActivate(event: React.KeyboardEvent, action: () => void) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    action();
  }
}

export function MobileQueueList({ patients, selectedId, onSelect }: { patients: PatientQueueItem[]; selectedId?: string; onSelect: (id: string, prescriptionId?: string) => void }) {
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
    <div className="h-full space-y-3 overflow-y-auto p-4 md:hidden">
      {patientGroups.length === 0 ? <div className="py-8 text-center text-sm font-bold text-slate-400">ไม่พบข้อมูลผู้ป่วย</div> : null}
      {patientGroups.map((group) => {
        const isExpanded = expandedHns.has(group.hn);
        const hasSelectedVisit = group.visits.some((visit) => visit.id === selectedId);
        const toggleGroup = () => toggleExpanded(group.hn);

        return (
          <article className={cn("overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm", (hasSelectedVisit || isExpanded) && "border-blue-300 bg-blue-50")} key={group.hn}>
            <div
              aria-expanded={isExpanded}
              className="w-full cursor-pointer p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
              onClick={toggleGroup}
              onKeyDown={(event) => handleKeyboardActivate(event, toggleGroup)}
              role="button"
              tabIndex={0}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-mono text-sm font-black text-blue-700">HN {group.hn}</div>
                  <div className="mt-1 text-base font-black text-slate-800">{group.name}</div>
                </div>
                <span className={cn("text-sm font-black", priorityStyles[group.priority])}>{group.priority}</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs font-bold text-slate-400">จำนวน VN</div>
                  <div className="mt-1 font-black text-blue-700">{group.visits.length} VN</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-400">PN / รายการยาทั้งหมด</div>
                  <div className="mt-1 font-black text-slate-600">{group.prescriptionCount} PN · {group.medicationCount} รายการ</div>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {group.alerts.length ? group.alerts.map((alert) => (
                    <span className={cn("flex h-8 w-8 items-center justify-center rounded-xl", alertStyles[alert])} key={alert}>{alertIcon(alert)}</span>
                  )) : <span className="text-sm font-bold text-slate-300">ไม่มีแจ้งเตือน</span>}
                </div>
                <span className="flex shrink-0 items-center gap-1 text-sm font-bold text-blue-600">
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  {isExpanded ? "ซ่อน VN / PN" : "ดู VN / PN"}
                </span>
              </div>
            </div>

            {isExpanded ? (
              <div className="space-y-4 border-t border-blue-100 bg-[#f6f9ff] p-3">
                {group.visits.map((visit) => {
                  const prescriptions = visit.prescriptions ?? [];

                  return (
                    <section key={visit.id}>
                      <div className="mb-2 flex items-center justify-between px-1">
                        <h3 className="font-mono text-sm font-black text-slate-700">VN {visit.vn}</h3>
                        <span className={cn("text-xs font-black", durationClass(visit.durationMinutes))}>{visit.durationMinutes}m</span>
                      </div>
                      <div className="space-y-2">
                        {(prescriptions.length ? prescriptions : [undefined]).map((prescription) => {
                          const rowKey = prescription?.id ?? visit.id;
                          const alerts = prescription?.alerts ?? visit.alerts;
                          const selectRow = () => onSelect(visit.id, prescription?.id);

                          return (
                            <div
                              className={cn(
                                "cursor-pointer rounded-xl border border-blue-100 bg-white p-3 transition hover:border-blue-300 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                                selectedId === visit.id && "border-blue-300 bg-blue-50",
                              )}
                              key={rowKey}
                              onClick={selectRow}
                              onKeyDown={(event) => handleKeyboardActivate(event, selectRow)}
                              role="button"
                              tabIndex={0}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="flex items-center gap-2 font-mono text-sm font-black text-blue-700">
                                    <FileText className="h-4 w-4" />
                                    {prescription ? `PN-${visit.vn}-${prescription.pn}` : "PN —"}
                                  </div>
                                  <div className="mt-1 text-xs font-bold text-slate-400">
                                    {prescription?.drugs.length ?? visit.medicationCount} รายการ · {prescription?.time ?? visit.time}
                                  </div>
                                </div>
                                <Badge className={stageStyles[visit.stage]}>{stageLabel(visit.stage)}</Badge>
                              </div>
                              <div className="mt-3 flex items-end justify-between gap-3">
                                <div className="flex flex-wrap gap-2">
                                  {alerts.length ? alerts.map((alert) => (
                                    <span className={cn("flex h-8 w-8 items-center justify-center rounded-xl", alertStyles[alert])} key={alert}>{alertIcon(alert)}</span>
                                  )) : <span className="text-xs font-bold text-slate-300">ไม่มีแจ้งเตือน</span>}
                                </div>
                                <div className="text-right text-xs font-bold text-slate-500">
                                  <div>{visit.doctor ?? "รอข้อมูลแพทย์"}</div>
                                  <div className={cn("mt-1", priorityStyles[visit.priority])}>{visit.priority}</div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
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
