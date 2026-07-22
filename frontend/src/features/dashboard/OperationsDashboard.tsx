"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, BarChart3, CheckCircle2, Clock3, FileCheck2, PhoneMissed, TimerReset } from "lucide-react";
import { getOperationsDashboard } from "@/lib/workstation-api";
import { cn } from "@/lib/utils";

const alertStyles = {
  danger: "bg-red-50 text-red-700",
  warning: "bg-amber-50 text-amber-700",
  muted: "bg-slate-100 text-slate-600",
};

export function OperationsDashboard() {
  const { data, isLoading } = useQuery({ queryKey: ["operations-dashboard"], queryFn: getOperationsDashboard });

  if (isLoading || !data) {
    return <div className="p-6 text-sm font-bold text-slate-400">กำลังโหลด dashboard...</div>;
  }

  const metricIcons = [FileCheck2, Clock3, TimerReset, CheckCircle2, PhoneMissed];
  const maxStage = Math.max(...data.stages.map((stage) => stage.count));
  const maxWait = 24;

  return (
    <div className="h-full min-h-0 overflow-y-auto p-4 md:p-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {data.metrics.map((metric, index) => {
          const Icon = metricIcons[index] ?? BarChart3;
          return (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={metric.label}>
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-sm font-black text-slate-500">{metric.label}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-3xl font-black text-slate-950">{metric.value}</span>
                <span className="text-sm font-bold text-slate-400">{metric.unit}</span>
              </div>
              <div className={cn("mt-3 text-sm font-bold", metric.good ? "text-emerald-600" : "text-slate-400")}>{metric.delta}</div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="font-black text-slate-900">ปริมาณงานแต่ละขั้นตอน</div>
            <div className="mt-1 text-sm font-semibold text-slate-400">จำนวนใบสั่งยาที่ค้างอยู่ในแต่ละสถานะ</div>
            <div className="mt-5 space-y-4">
              {data.stages.map((stage) => (
                <div className="grid grid-cols-[92px_minmax(0,1fr)_36px] items-center gap-3" key={stage.label}>
                  <div className="text-sm font-black text-slate-600">{stage.label}</div>
                  <div className="h-7 overflow-hidden rounded-lg bg-slate-100">
                    <div className="h-full rounded-lg" style={{ width: `${Math.max(8, (stage.count / maxStage) * 100)}%`, backgroundColor: stage.color }} />
                  </div>
                  <div className="text-right font-mono font-black text-slate-800">{stage.count}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="font-black text-slate-900">เวลารอรับยาเฉลี่ย</div>
                <div className="mt-1 text-sm font-semibold text-slate-400">นาที · รายชั่วโมง</div>
              </div>
              <div className="text-xs font-bold text-slate-400">เป้าหมาย ≤ 15 นาที</div>
            </div>
            <div className="mt-5 flex h-40 items-end gap-4">
              {data.waits.map((wait) => {
                const over = wait.minute > 15;
                return (
                  <div className="flex h-full flex-1 flex-col items-center justify-end gap-2" key={wait.hour}>
                    <span className={cn("font-mono text-sm font-black", over ? "text-red-600" : "text-emerald-600")}>{wait.minute}</span>
                    <div className={cn("w-full max-w-9 rounded-t-lg", over ? "bg-red-300" : "bg-emerald-300")} style={{ height: `${Math.round((wait.minute / maxWait) * 96)}px` }} />
                    <span className="font-mono text-xs font-bold text-slate-400">{wait.hour}</span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="font-black text-slate-900">ภาระงานเครื่องจัดยา</div>
            <div className="mt-1 text-sm font-semibold text-slate-400">คิวรอจัด · เกณฑ์เปลี่ยนเครื่อง 15 นาที</div>
            <div className="mt-5 space-y-5">
              {data.robots.map((robot) => {
                const over = robot.load > 15;
                const color = over ? "#dc2626" : robot.load >= 12 ? "#d97706" : "#16a34a";
                return (
                  <div key={robot.tag}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="rounded-lg px-2 py-1 text-xs font-black" style={{ color, backgroundColor: `${color}1a` }}>{robot.tag}</span>
                        <span className="text-sm font-black text-slate-700">{robot.name}</span>
                      </div>
                      <span className="font-mono text-sm font-black" style={{ color }}>{robot.load}m</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, (robot.load / 20) * 100)}%`, backgroundColor: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="font-black text-slate-900">แจ้งเตือนระบบ</div>
            <div className="mt-4 space-y-3">
              {data.alerts.map((alert) => (
                <div className={cn("flex items-center gap-3 rounded-2xl p-4", alertStyles[alert.tone as keyof typeof alertStyles])} key={alert.title}>
                  <AlertTriangle className="h-5 w-5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-black">{alert.title}</div>
                    <div className="truncate text-sm font-semibold opacity-75">{alert.subtitle}</div>
                  </div>
                  <span className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-white/70 px-2 font-mono font-black">{alert.count}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
