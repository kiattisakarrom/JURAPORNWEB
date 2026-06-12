"use client";

import { AlertTriangle, CheckCircle2, Pill } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { StockCheckResponse } from "@/types/pharmacy";

export function MachineStockCheck({ stockCheck, isLoading }: { stockCheck?: StockCheckResponse; isLoading: boolean }) {
  const hasShortage = stockCheck ? !stockCheck.canSetPending : false;

  return (
    <section className="space-y-4 border-t border-slate-100 pt-5">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-black uppercase tracking-[0.14em] text-slate-400">Machine & Stock Check</h3>
        {stockCheck ? (
          <span className={cn("flex h-8 w-8 items-center justify-center rounded-full", stockCheck.canSetPending ? "bg-emerald-100 text-emerald-700" : "bg-yellow-100 text-amber-700")}>
            {stockCheck.canSetPending ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          </span>
        ) : null}
      </div>

      {isLoading && !stockCheck ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-500">กำลังดึงข้อมูลจากเครื่องและสต็อก...</div>
      ) : null}

      {stockCheck ? (
        <>
          <div className="space-y-3">
            {stockCheck.items.map((item) => {
              const isEnough = item.available >= item.required;
              const percentage = Math.min(100, Math.round((item.available / item.capacity) * 100));

              return (
                <div
                  className={cn(
                    "rounded-2xl border p-4 shadow-sm",
                    isEnough ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-yellow-200 bg-yellow-50 text-amber-950",
                  )}
                  key={item.id}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <Pill className={cn("h-6 w-6 shrink-0", isEnough ? "text-emerald-600" : "text-orange-500")} />
                      <div className="min-w-0">
                        <div className="truncate text-base font-black text-slate-950">{item.drugName}</div>
                      </div>
                    </div>
                    <div className={cn("shrink-0 text-sm font-black", isEnough ? "text-emerald-600" : "text-orange-500")}>
                      {isEnough ? "✓ พอ" : "⚠ ไม่พอ"}
                    </div>
                  </div>
                  <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-200">
                    <div className={cn("h-full rounded-full", isEnough ? "bg-emerald-500" : "bg-orange-400")} style={{ width: `${percentage}%` }} />
                  </div>
                  <div className="mt-3 flex flex-col gap-1 text-sm font-bold text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-mono text-cyan-700">{item.machineName}</span>
                    <span>
                      คงเหลือ {item.available}/{item.capacity}
                      {!isEnough ? <span className="ml-2 text-orange-600">ขาด {item.required - item.available} ที่ {item.machineName}</span> : null}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {hasShortage ? (
            <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-amber-950">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                <div>
                  <div className="font-black">ยาไม่เพียงพอ — ต้องตั้ง Pending</div>
                  <div className="mt-2 text-sm font-semibold leading-6 text-amber-900">{stockCheck.shortageMessage}</div>
                </div>
              </div>
            </div>
          ) : null}

          <Button
            className={cn(
              "h-14 w-full text-base",
              stockCheck.canSetPending
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                : "bg-yellow-100 text-amber-900 hover:bg-yellow-100 disabled:opacity-100",
            )}
            disabled={!stockCheck.canSetPending}
            onClick={() => toast.success("ตั้ง Pending สำเร็จ")}
          >
            {stockCheck.canSetPending ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
            {stockCheck.canSetPending ? "Set Pending" : "Set Pending — ยาไม่พอ"}
          </Button>
        </>
      ) : null}
    </section>
  );
}
