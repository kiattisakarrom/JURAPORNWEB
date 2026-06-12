"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PatientQueueItem } from "@/types/pharmacy";
import { alertIcon, alertStyles, durationClass, priorityStyles, stageLabel, stageStyles } from "./queue-ui";

export function MobileQueueList({ patients, selectedId, onSelect }: { patients: PatientQueueItem[]; selectedId?: string; onSelect: (id: string) => void }) {
  return (
    <div className="h-full space-y-3 overflow-y-auto p-4 md:hidden">
      {patients.map((patient) => (
        <button
          className={cn("w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm", selectedId === patient.id && "border-blue-300 bg-blue-50")}
          key={patient.id}
          onClick={() => onSelect(patient.id)}
          type="button"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-base font-black">{patient.name}</div>
              <div className="mt-1 text-xs font-bold text-slate-400">VN {patient.vn} · HN {patient.hn}</div>
            </div>
            <span className={cn("text-sm font-black", priorityStyles[patient.priority])}>{patient.priority}</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs font-bold text-slate-400">สถานะ</div>
              <Badge className={cn("mt-1", stageStyles[patient.stage])}>{stageLabel(patient.stage)}</Badge>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-400">Duration</div>
              <div className={cn("mt-1 font-black", durationClass(patient.durationMinutes))}>{patient.durationMinutes}m</div>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-400">รายการยา</div>
              <div className="mt-1 font-black text-slate-600">{patient.medicationCount} รายการ</div>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-400">เวลา</div>
              <div className="mt-1 font-mono font-black text-slate-500">{patient.time}</div>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex gap-2">
              {patient.alerts.length ? patient.alerts.map((alert) => (
                <span className={cn("flex h-8 w-8 items-center justify-center rounded-xl", alertStyles[alert])} key={alert}>{alertIcon(alert)}</span>
              )) : <span className="text-sm font-bold text-slate-300">ไม่มีแจ้งเตือน</span>}
            </div>
            <span className="text-sm font-bold text-slate-400">{patient.pharmacist ?? "รอ Verify"}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
