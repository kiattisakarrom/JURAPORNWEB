"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, FilePlus2, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getMedicationErrorReports, type MedicationErrorReport } from "@/lib/workstation-api";
import { cn } from "@/lib/utils";

const severity = {
  A: { category: "No Error", color: "#94a3b8" },
  B: { category: "No Harm", color: "#16a34a" },
  C: { category: "No Harm", color: "#3f9d5c" },
  D: { category: "No Harm", color: "#5cab73" },
  E: { category: "Harm", color: "#d97706" },
  F: { category: "Harm", color: "#ea580c" },
  G: { category: "Harm", color: "#dc2626" },
  H: { category: "Harm", color: "#be123c" },
  I: { category: "Death", color: "#7f1d1d" },
};

type Filter = "all" | "yes" | "no" | "noharm" | "harm";

export function MedicationErrorScreen({ search }: { search: string }) {
  const [filter, setFilter] = useState<Filter>("all");
  const { data = [], isLoading } = useQuery({ queryKey: ["medication-error-reports"], queryFn: getMedicationErrorReports });

  const rows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return data.filter((report) => {
      const matchesSearch = !keyword || [report.code, report.vn, report.hn, report.name, report.drug, report.stage].some((value) => value.toLowerCase().includes(keyword));
      const matchesFilter =
        filter === "all" ||
        (filter === "yes" && report.isError) ||
        (filter === "no" && !report.isError) ||
        (filter === "noharm" && report.isError && !!report.severity && ["A", "B", "C", "D"].includes(report.severity)) ||
        (filter === "harm" && report.isError && !!report.severity && ["E", "F", "G", "H", "I"].includes(report.severity));
      return matchesSearch && matchesFilter;
    });
  }, [data, filter, search]);

  const total = data.length;
  const errorCount = data.filter((report) => report.isError).length;
  const nonErrorCount = total - errorCount;
  const harmCount = data.filter((report) => report.isError && report.severity && ["E", "F", "G", "H", "I"].includes(report.severity)).length;

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "ทั้งหมด" },
    { id: "yes", label: "เป็น ME" },
    { id: "no", label: "ไม่เป็น ME" },
    { id: "noharm", label: "No Harm (A-D)" },
    { id: "harm", label: "Harm (E-I)" },
  ];

  return (
    <div className="h-full min-h-0 overflow-y-auto p-4 md:p-6">
      <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-950">รายงานความคลาดเคลื่อนทางยา</h1>
          <p className="mt-1 text-sm font-semibold text-slate-400">Medication Error Report · เตรียมโครงข้อมูลเพื่อรับ API จริง</p>
        </div>
        <Button><FilePlus2 className="h-4 w-4" />รายงาน ME ใหม่</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "รายงานทั้งหมด", value: total, unit: "ฉบับ", icon: ShieldCheck, className: "text-blue-700 bg-blue-50" },
          { label: "เป็น Medication Error", value: errorCount, unit: "ฉบับ", icon: AlertTriangle, className: "text-red-700 bg-red-50" },
          { label: "ไม่เป็น ME", value: nonErrorCount, unit: "ฉบับ", icon: ShieldCheck, className: "text-slate-600 bg-slate-100" },
          { label: "ถึงขั้นเป็นอันตราย", value: harmCount, unit: "ฉบับ", icon: AlertTriangle, className: "text-orange-700 bg-orange-50" },
        ].map((metric) => {
          const Icon = metric.icon;
          return (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={metric.label}>
              <div className="mb-3 flex items-center gap-3">
                <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", metric.className)}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-sm font-black text-slate-500">{metric.label}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-3xl font-black text-slate-950">{metric.value}</span>
                <span className="text-sm font-bold text-slate-400">{metric.unit}</span>
              </div>
            </div>
          );
        })}
      </div>

      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 font-black text-slate-900">การกระจายตามระดับความรุนแรง</div>
        <div className="grid grid-cols-3 gap-2 md:grid-cols-9">
          {Object.entries(severity).map(([key, value]) => {
            const count = data.filter((report) => report.severity === key).length;
            return (
              <div className="rounded-2xl border border-slate-100 p-3 text-center" key={key} style={{ backgroundColor: count ? `${value.color}12` : "#f8fafc" }}>
                <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl font-black text-white" style={{ backgroundColor: value.color }}>{key}</div>
                <div className="mt-2 font-mono text-xl font-black" style={{ color: count ? value.color : "#cbd5e1" }}>{count}</div>
                <div className="text-[11px] font-bold text-slate-400">{value.category}</div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
        {filters.map((item) => (
          <button
            className={cn(
              "shrink-0 rounded-xl border px-4 py-2 text-sm font-black transition",
              filter === item.id ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-500 hover:border-blue-200",
            )}
            key={item.id}
            onClick={() => setFilter(item.id)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {isLoading ? <div className="p-4 text-sm font-bold text-slate-400">กำลังโหลดข้อมูล...</div> : null}
        {rows.map((report: MedicationErrorReport) => {
          const sev = report.severity ? severity[report.severity] : undefined;
          return (
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={report.code}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono font-black text-slate-950">{report.code}</span>
                <Badge className="bg-blue-50 text-blue-700">{report.stage}</Badge>
                <Badge className={report.isError ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"}>{report.isError ? "เป็น ME" : "ไม่เป็น ME"}</Badge>
                {sev ? (
                  <span className="inline-flex items-center gap-2 rounded-lg px-2 py-1 text-xs font-black" style={{ backgroundColor: `${sev.color}14`, color: sev.color }}>
                    <span className="flex h-5 w-5 items-center justify-center rounded-md text-white" style={{ backgroundColor: sev.color }}>{report.severity}</span>
                    {sev.category}
                  </span>
                ) : null}
                <span className="ml-auto font-mono text-xs font-bold text-slate-400">{report.date} · {report.time}</span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="font-black text-slate-800">{report.name}</span>
                <span className="text-sm font-bold text-slate-400">VN {report.vn} · HN {report.hn}</span>
                <span className="text-sm font-black text-slate-600">{report.drug}</span>
              </div>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{report.description}</p>
              <div className="mt-3 text-xs font-bold text-slate-400">ผู้รายงาน: {report.reporter}</div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
