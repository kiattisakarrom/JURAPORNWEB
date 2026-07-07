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
      <table className="w-full min-w-[1100px] table-fixed border-collapse text-left">
        <colgroup>
          <col className="w-[128px]" />
          <col className="w-[98px]" />
          <col className="w-[98px]" />
          <col className="w-[240px]" />
          <col className="w-[134px]" />
          <col className="w-[106px]" />
          <col className="w-[146px]" />
          <col className="w-[82px]" />
          <col className="w-[104px]" />
          <col className="w-[134px]" />
        </colgroup>
        <thead className="sticky top-0 z-20 border-b border-[#e6eaf0] bg-white text-[11px] font-bold uppercase tracking-[0.07em] text-[#9aa7b8] shadow-[0_1px_0_#e6eaf0]">
          <tr>
            {["Priority", "VN", "HN", "ชื่อ-นามสกุล", "สถานะ", "รายการยา", "แจ้งเตือน", "เวลา", "Duration", "เภสัชกร"].map((label) => (
              <th className="h-[42px] px-4" key={label}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {isLoading ? (
            <tr><td className="px-5 py-8 text-sm font-bold text-slate-400" colSpan={10}>กำลังโหลดข้อมูล...</td></tr>
          ) : patients.map((patient) => (
            <tr
              className={cn("cursor-pointer transition hover:bg-[#f6f9ff]", selectedId === patient.id && "bg-[#f6f9ff]")}
              key={patient.id}
              onClick={() => onSelect(patient.id)}
            >
              <td className={cn("h-[62px] px-4 text-sm font-black", priorityStyles[patient.priority])}>
                <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-current" />
                {patient.priority}
              </td>
              <td className="px-4 font-mono text-[15px] font-bold text-[#15233b]">{patient.vn}</td>
              <td className="px-4 font-mono text-sm text-[#94a3b8]">{patient.hn}</td>
              <td className="px-4 text-[15px] font-semibold text-[#22324a]">{patient.name}</td>
              <td className="px-4">
                <Badge className={stageStyles[patient.stage]}>
                  <span className={cn("mr-2 h-2 w-2 rounded-full", stageDotStyles[patient.stage])} />
                  {stageLabel(patient.stage)}
                </Badge>
              </td>
              <td className="px-4 text-sm font-semibold text-[#56657a]">{patient.medicationCount} รายการ</td>
              <td className="px-4">
                <div className="flex gap-2">
                  {patient.alerts.length ? patient.alerts.map((alert) => (
                    <span className={cn("flex h-[30px] w-[30px] items-center justify-center rounded-[10px]", alertStyles[alert])} key={alert}>{alertIcon(alert)}</span>
                  )) : <span className="text-slate-300">—</span>}
                </div>
              </td>
              <td className="px-4 font-mono text-[13px] text-[#94a3b8]">{patient.time}</td>
              <td className={cn("px-4 text-right font-mono text-[15px] font-bold", durationClass(patient.durationMinutes))}>{patient.durationMinutes}m</td>
              <td className="px-4">
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
