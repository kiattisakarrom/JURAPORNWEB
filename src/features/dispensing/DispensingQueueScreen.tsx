"use client";

import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, BellRing, CreditCard, Megaphone, Printer, Volume2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getDispensingQueue, type DispensingQueueItem } from "@/lib/workstation-api";
import { cn } from "@/lib/utils";

const statusStyles: Record<DispensingQueueItem["status"], string> = {
  waiting: "bg-amber-50 text-amber-700",
  ready: "bg-cyan-50 text-cyan-700",
  called: "bg-blue-50 text-blue-700",
  dispensing: "bg-cyan-50 text-cyan-700",
  complete: "bg-emerald-50 text-emerald-700",
  "missed-call": "bg-red-50 text-red-700",
};

export function DispensingQueueScreen({ search }: { search: string }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data = [], isLoading } = useQuery({ queryKey: ["dispensing-queue"], queryFn: getDispensingQueue });

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return data.filter((item) => !keyword || [item.vn, item.hn, item.name, item.channel].some((value) => value.toLowerCase().includes(keyword)));
  }, [data, search]);

  const selected = filtered.find((item) => item.id === selectedId) ?? filtered[0];
  const upcoming = data.filter((item) => ["waiting", "ready"].includes(item.status)).slice(0, 4);
  const calling = data.find((item) => item.status === "dispensing") ?? data[0];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-col border-b border-slate-200 bg-white md:flex-row">
        <div className="flex items-center gap-5 bg-slate-950 px-5 py-4 text-white md:px-6">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">กำลังเรียกคิว</div>
            <div className="font-mono text-3xl font-black">{calling?.vn ?? "-"}</div>
          </div>
          <div className="h-10 w-px bg-slate-700" />
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">ช่องจ่ายยา</div>
            <div className="font-mono text-3xl font-black text-blue-300">{calling?.channel ?? "-"}</div>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto px-4 py-3">
          <span className="shrink-0 text-sm font-black text-slate-400">คิวถัดไป</span>
          {upcoming.map((item) => (
            <Badge className="shrink-0 bg-slate-100 px-3 py-2 text-slate-600" key={item.id}>VN {item.vn} · ช่อง {item.channel}</Badge>
          ))}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="min-h-0 border-b border-slate-200 bg-white p-3 md:border-b-0 md:border-r md:p-4">
          <div className="flex h-full gap-3 overflow-x-auto md:flex-col md:overflow-y-auto">
            {isLoading ? <div className="p-4 text-sm font-bold text-slate-400">กำลังโหลดข้อมูล...</div> : null}
            {filtered.map((item) => (
              <button
                className={cn(
                  "min-w-[280px] rounded-2xl border bg-white p-4 text-left transition md:min-w-0",
                  selected?.id === item.id ? "border-blue-400 bg-blue-50 shadow-sm" : "border-slate-100 hover:border-blue-200 hover:bg-slate-50",
                )}
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                type="button"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="font-mono text-lg font-black text-slate-900">{item.vn}</div>
                  <Badge className={statusStyles[item.status]}>{item.status}</Badge>
                </div>
                <div className="mt-2 truncate font-black text-slate-800">{item.name}</div>
                <div className="mt-2 flex items-center gap-2 text-xs font-bold text-slate-400">
                  <span>{item.demo}</span>
                  <span>·</span>
                  <span>ช่อง {item.channel}</span>
                  {item.isStat ? <span className="rounded bg-red-50 px-2 py-0.5 text-red-600">ด่วน</span> : null}
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="min-h-0 overflow-y-auto p-4 md:p-6">
          {selected ? (
            <div className="w-full">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-2xl font-black text-slate-950">{selected.name}</h2>
                      <Badge className={statusStyles[selected.status]}>{selected.status}</Badge>
                    </div>
                    <div className="mt-2 text-sm font-semibold text-slate-500">VN {selected.vn} · HN {selected.hn} · {selected.demo}</div>
                  </div>
                  <div className="text-left md:text-right">
                    <div className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">คิว / ช่อง</div>
                    <div className="font-mono text-xl font-black text-slate-700">{selected.vn} · {selected.channel}</div>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-blue-700">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <CreditCard className="h-5 w-5 shrink-0" />
                      <span className="font-bold">ยืนยันตัวตนผู้ป่วย</span>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <Button className="border-blue-200 bg-white text-blue-700 hover:bg-blue-50" variant="outline">เสียบบัตรประชาชน</Button>
                      <Button className="border-blue-200 bg-white text-blue-700 hover:bg-blue-50" variant="outline">สแกน barcode ใบนำทาง</Button>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-4">
                  <div className="text-xs font-black uppercase tracking-[0.08em] text-amber-700">โน้ตจากหน้า Verify</div>
                  <div className="mt-1 text-sm font-semibold text-amber-900">{selected.verifyNote}</div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {selected.chips.map((chip) => (
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-2" key={chip.label}>
                      <span className="text-xs font-black text-slate-400">{chip.label} </span>
                      <span className={cn("font-mono font-black", chip.high ? "text-red-600" : "text-slate-700")}>{chip.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 text-xs font-black uppercase tracking-[0.12em] text-slate-400">รายการยาที่จ่าย ({selected.drugs.length})</div>
              <div className="mt-3 space-y-3">
                {selected.drugs.map((drug) => (
                  <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center" key={drug.name}>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-black text-slate-900">{drug.name}</div>
                      <div className="text-sm font-semibold text-slate-500">{drug.sig}</div>
                    </div>
                    <div className="font-mono font-black text-slate-600">{drug.quantity}</div>
                    <div className="h-11 w-11 rounded-xl border border-slate-200 bg-slate-100" />
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl text-white" style={{ backgroundColor: drug.color }}>
                      <BadgeCheck className="h-5 w-5" />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border border-violet-100 bg-violet-50 p-5">
                <div className="mb-3 flex items-center gap-2 font-black text-violet-700"><BellRing className="h-5 w-5" />Prime Question</div>
                <div className="grid gap-3 md:grid-cols-3">
                  {["ยานี้ใช้สำหรับอะไร", "แพทย์บอกวิธีใช้อย่างไร", "แพทย์บอกผลที่คาดหวังอย่างไร"].map((question) => (
                    <label className="flex items-center gap-3 rounded-xl bg-white p-3 text-sm font-bold text-violet-900" key={question}>
                      <input className="h-5 w-5 accent-violet-600" type="checkbox" />
                      {question}
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-3 pb-2 md:flex-row md:items-center">
                <Button variant="outline"><Printer className="h-4 w-4" />พิมพ์ใบ NED / MR</Button>
                <div className="flex-1" />
                <Button variant="outline"><Megaphone className="h-4 w-4" />Missed-call</Button>
                <Button className="bg-cyan-600 hover:bg-cyan-700"><Volume2 className="h-4 w-4" />อัปเดตสถานะคิว</Button>
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-400">
              <Megaphone className="h-12 w-12" />
              <div className="font-bold">ไม่พบคิวจ่ายยา</div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
