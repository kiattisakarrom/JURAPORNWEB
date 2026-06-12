"use client";

import { Send, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PatientQueueItem } from "@/types/pharmacy";
import { alertIcon, alertStyles, durationClass, priorityStyles, stageDotStyles, stageLabel, stageStyles } from "./queue-ui";

export function QueueTable({
  patients,
  selectedId,
  isLoading,
  onClose,
  onSelect,
}: {
  patients: PatientQueueItem[];
  selectedId?: string;
  isLoading: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="stable-scrollbar hidden h-full min-h-0 overflow-auto md:block">
      <table className="w-full min-w-[1180px] table-fixed border-collapse text-left">
        <colgroup>
          <col className="w-[140px]" />
          <col className="w-[120px]" />
          <col className="w-[120px]" />
          <col className="w-[260px]" />
          <col className="w-[150px]" />
          <col className="w-[130px]" />
          <col className="w-[140px]" />
          <col className="w-[110px]" />
          <col className="w-[130px]" />
          <col className="w-[160px]" />
        </colgroup>
        <thead className="sticky top-0 z-20 border-b border-slate-200 bg-white text-xs font-black uppercase tracking-[0.12em] text-slate-400 shadow-[0_1px_0_#dfe7f1]">
          <tr>
            {["Priority", "VN", "HN", "ชื่อ-นามสกุล", "สถานะ", "รายการยา", "แจ้งเตือน", "เวลา", "Duration", "เภสัชกร"].map((label) => (
              <th className="h-14 px-5" key={label}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {isLoading ? (
            <tr><td className="px-5 py-8 text-sm font-bold text-slate-400" colSpan={10}>กำลังโหลดข้อมูล...</td></tr>
          ) : patients.map((patient) => (
            <tr
              className={cn("cursor-pointer transition hover:bg-blue-50/50", selectedId === patient.id && "bg-blue-50")}
              key={patient.id}
              onClick={() => onSelect(patient.id)}
            >
              <td className={cn("h-[76px] px-5 text-sm font-black", priorityStyles[patient.priority])}>
                <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-current" />
                {patient.priority}
              </td>
              <td className="px-5 font-black text-slate-600">{patient.vn}</td>
              <td className="px-5 font-semibold text-slate-400">{patient.hn}</td>
              <td className="px-5 font-black text-slate-900">{patient.name}</td>
              <td className="px-5">
                <Badge className={stageStyles[patient.stage]}>
                  <span className={cn("mr-2 h-2 w-2 rounded-full", stageDotStyles[patient.stage])} />
                  {stageLabel(patient.stage)}
                </Badge>
              </td>
              <td className="px-5 font-semibold text-slate-500">{patient.medicationCount} รายการ</td>
              <td className="px-5">
                <div className="flex gap-2">
                  {patient.alerts.length ? patient.alerts.map((alert) => (
                    <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", alertStyles[alert])} key={alert}>{alertIcon(alert)}</span>
                  )) : <span className="text-slate-300">—</span>}
                </div>
              </td>
              <td className="px-5 font-mono font-bold text-slate-400">{patient.time}</td>
              <td className={cn("px-5 font-black", durationClass(patient.durationMinutes))}>{patient.durationMinutes}m</td>
              <td className="px-5">
                {selectedId === patient.id ? (
                  <Button
                    onClick={(event) => {
                      event.stopPropagation();
                      onClose();
                    }}
                    size="sm"
                  >
                    <X className="h-4 w-4" />
                    ปิด
                  </Button>
                ) : (
                  patient.pharmacist ? (
                    <span className="text-sm font-bold text-slate-400">{patient.pharmacist}</span>
                  ) : (
                    <Button
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelect(patient.id);
                      }}
                      size="sm"
                      variant="secondary"
                    >
                      <Send className="h-4 w-4" />
                      Verify
                    </Button>
                  )
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
