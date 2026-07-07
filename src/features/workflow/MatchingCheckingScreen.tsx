"use client";

import { useQuery } from "@tanstack/react-query";
import { Boxes, CheckCircle2, ClipboardCheck, PackageCheck, Play, Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getWorkflowBaskets, type WorkflowBasketItem, type WorkflowStage } from "@/lib/workstation-api";
import { cn } from "@/lib/utils";

const machineStyles = {
  Box: "bg-blue-50 text-blue-700",
  INJ: "bg-violet-50 text-violet-700",
  Smart: "bg-cyan-50 text-cyan-700",
  Cold: "bg-sky-50 text-sky-700",
};

const statusStyles = {
  wait: { label: "รอดำเนินการ", className: "bg-amber-50 text-amber-700", dot: "bg-[#e0a008]", progress: "bg-[#e07d12]" },
  doing: { label: "กำลังดำเนินการ", className: "bg-orange-50 text-orange-700", dot: "bg-[#e07d12]", progress: "bg-[#e07d12]" },
  done: { label: "เสร็จแล้ว", className: "bg-emerald-50 text-emerald-700", dot: "bg-[#16a34a]", progress: "bg-[#16a34a]" },
};

function progressOf(basket: WorkflowBasketItem) {
  const done = basket.items.filter((item) => item.status === "done").length;
  const doing = basket.items.some((item) => item.status === "doing");
  return {
    done,
    total: basket.items.length,
    percent: Math.round((done / basket.items.length) * 100),
    state: done === basket.items.length ? "done" : doing || done > 0 ? "doing" : "wait",
  } as const;
}

export function MatchingCheckingScreen({ search }: { search: string }) {
  const [activeStage, setActiveStage] = useState<WorkflowStage>("matching");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [itemStatus, setItemStatus] = useState<Record<string, WorkflowBasketItem["items"][number]["status"]>>({});
  const [basketStage, setBasketStage] = useState<Record<string, WorkflowStage>>({});
  const { data = [], isLoading } = useQuery({ queryKey: ["workflow-baskets"], queryFn: getWorkflowBaskets });

  const baskets = useMemo(
    () =>
      data.map((basket) => ({
        ...basket,
        stage: basketStage[basket.id] ?? basket.stage,
        items: basket.items.map((item) => ({
          ...item,
          status: itemStatus[item.id] ?? item.status,
        })),
      })),
    [basketStage, data, itemStatus],
  );

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return baskets.filter((basket) => {
      const matchesStage = basket.stage === activeStage;
      const matchesSearch = !keyword || [basket.basket, basket.vn, basket.hn, basket.name, basket.guide].some((value) => value.toLowerCase().includes(keyword));
      return matchesStage && matchesSearch;
    });
  }, [activeStage, baskets, search]);

  const selected = filtered.find((basket) => basket.id === selectedId) ?? filtered[0];
  const selectedProgress = selected ? progressOf(selected) : undefined;

  function advanceItem(item: WorkflowBasketItem["items"][number]) {
    if (item.status === "done") return;
    setItemStatus((current) => ({
      ...current,
      [item.id]: item.status === "wait" ? "doing" : "done",
    }));
  }

  function sendSelectedToChecking() {
    if (!selected || selectedProgress?.done !== selectedProgress?.total) return;

    setBasketStage((current) => ({
      ...current,
      [selected.id]: "checking",
    }));
    setItemStatus((current) => {
      const next = { ...current };
      selected.items.forEach((item) => {
        next[item.id] = "wait";
      });
      return next;
    });
    setActiveStage("checking");
    setSelectedId(selected.id);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-5 border-b border-slate-200 bg-white px-4 md:px-6">
        {(["matching", "checking"] as WorkflowStage[]).map((stage) => {
          const active = activeStage === stage;
          const count = baskets.filter((basket) => basket.stage === stage).length;
          return (
            <button
              className={cn("relative flex h-14 items-center gap-2 text-sm font-black text-slate-500 transition hover:text-blue-600", active && "text-blue-700")}
              key={stage}
              onClick={() => {
                setActiveStage(stage);
                setSelectedId(null);
              }}
              type="button"
            >
              {stage === "matching" ? "Matching · จับคู่" : "Checking · ตรวจสอบ"}
              <span className={cn("rounded-lg px-2 py-1 text-xs", active ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500")}>{count}</span>
              {active ? <span className="absolute bottom-0 left-0 right-0 h-1 rounded-t-full bg-blue-600" /> : null}
            </button>
          );
        })}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[392px_minmax(0,1fr)]">
        <aside className="min-h-0 border-b border-slate-200 bg-white p-3 md:border-b-0 md:border-r md:p-4">
          <div className="flex h-full min-h-0 gap-3 overflow-x-auto md:flex-col md:overflow-y-auto">
            {isLoading ? <div className="p-4 text-sm font-bold text-slate-400">กำลังโหลดข้อมูล...</div> : null}
            {filtered.map((basket) => {
              const progress = progressOf(basket);
              const active = selected?.id === basket.id;
              const status = statusStyles[progress.state];
              return (
                <button
                  className={cn(
                    "min-w-[280px] rounded-2xl border bg-white p-4 text-left transition md:min-w-0",
                    active ? "border-blue-400 bg-blue-50 shadow-sm" : "border-slate-100 hover:border-blue-200 hover:bg-slate-50",
                  )}
                  key={basket.id}
                  onClick={() => setSelectedId(basket.id)}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-mono text-base font-black text-slate-900">{basket.basket}</div>
                    <Badge className={status.className}>{status.label}</Badge>
                  </div>
                  <div className="mt-2 truncate font-black text-slate-800">{basket.name}</div>
                  <div className="mt-1 text-xs font-bold text-slate-400">VN {basket.vn} · ใบนำทาง {basket.guide}</div>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div className={cn("h-full rounded-full", status.progress)} style={{ width: `${progress.percent}%` }} />
                    </div>
                    <span className="font-mono text-xs font-black text-slate-500">{progress.done}/{progress.total}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="min-h-0 overflow-y-auto p-4 md:p-6">
          {selected && selectedProgress ? (
            <div className="w-full">
              <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="font-mono text-2xl font-black text-slate-950">{selected.basket}</h2>
                    <Badge className={statusStyles[selectedProgress.state].className}>{statusStyles[selectedProgress.state].label}</Badge>
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-500">{selected.name} · VN {selected.vn} · HN {selected.hn}</div>
                </div>
                <div className="text-left md:text-right">
                  <div className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">ใบนำทาง</div>
                  <div className="font-mono text-xl font-black text-slate-700">{selected.guide}</div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                  <div className="flex-1">
                    <div className="mb-2 text-sm font-bold text-slate-500">ความคืบหน้าการรวบรวมยา</div>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                      <div className={cn("h-full rounded-full transition-all", statusStyles[selectedProgress.state].progress)} style={{ width: `${selectedProgress.percent}%` }} />
                    </div>
                  </div>
                  <div className="font-mono text-2xl font-black text-slate-900">{selectedProgress.done}/{selectedProgress.total}</div>
                </div>
              </div>

              <div className="mt-5 text-xs font-black uppercase tracking-[0.12em] text-slate-400">รายการยาในตะกร้า</div>
              <div className="mt-3 space-y-3">
                {selected.items.map((item) => {
                  const status = statusStyles[item.status];
                  return (
                    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center" key={item.id}>
                      <span className={cn("h-3 w-3 rounded-full", status.dot)} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-black text-slate-900">{item.name}</div>
                        <div className="text-sm font-bold text-slate-400">{status.label}</div>
                      </div>
                      <Badge className={machineStyles[item.machine]}>{item.machine}</Badge>
                      <div className="font-mono font-black text-slate-600 md:w-24 md:text-right">{item.quantity}</div>
                      <Button
                        className={cn(
                          item.status === "wait" && "bg-[#e0a008] hover:bg-[#bd8208]",
                          item.status === "doing" && "bg-[#e07d12] hover:bg-[#c76a0d]",
                          item.status === "done" && "cursor-default bg-[#e7f6ec] text-[#16a34a] hover:bg-[#e7f6ec]",
                        )}
                        onClick={() => advanceItem(item)}
                        size="sm"
                        variant={item.status === "done" ? "secondary" : "default"}
                      >
                        {item.status === "done" ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <>
                            <Play className="h-4 w-4" />
                            {item.status === "doing" ? "เสร็จ" : "เริ่ม"}
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>

              <div className="sticky bottom-0 mt-5 flex flex-col gap-3 bg-transparent pb-2 pt-3 md:flex-row md:items-center">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
                  {activeStage === "matching" ? <Boxes className="h-4 w-4" /> : <ClipboardCheck className="h-4 w-4" />}
                  {activeStage === "matching" ? "สแกนใบนำทางเพื่อจับคู่ยา เมื่อครบให้พิมพ์ฉลาก" : "สแกนยืนยันความถูกต้อง เมื่อครบส่งต่อ AGV"}
                </div>
                <div className="flex-1" />
                <Button variant="outline"><Printer className="h-4 w-4" />พิมพ์เอกสาร</Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700"
                  disabled={selectedProgress.done !== selectedProgress.total}
                  onClick={activeStage === "matching" ? sendSelectedToChecking : undefined}
                >
                  <PackageCheck className="h-4 w-4" />
                  {activeStage === "matching" ? "ส่ง Checking" : "ส่ง AGV"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-400">
              <Boxes className="h-12 w-12" />
              <div className="font-bold">ไม่พบตะกร้าในเงื่อนไขนี้</div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
