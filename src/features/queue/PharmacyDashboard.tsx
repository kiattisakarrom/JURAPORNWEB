"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, Clock3, LogOut, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getPharmacyQueue } from "@/lib/pharmacy-api";
import { cn } from "@/lib/utils";
import type { QueueStage } from "@/types/pharmacy";
import { CheckingCheckoutPopup } from "@/features/checking/CheckingCheckoutPopup";
import { DispensingPopup } from "@/features/dispensing/DispensingPopup";
import { MatchingPopup } from "@/features/matching/MatchingPopup";
import { PatientPanel } from "@/features/verify/PatientPanel";
import { MobileQueueList } from "./MobileQueueList";
import { QueueTable } from "./QueueTable";

const tabs: { id: QueueStage; label: string }[] = [
  { id: "all", label: "ทั้งหมด" },
  { id: "verify", label: "Verify" },
  { id: "picking", label: "Picking" },
  { id: "matching", label: "Matching" },
  { id: "checking", label: "Checking" },
  { id: "dispensing", label: "Dispensing" },
  { id: "pending", label: "Pending" },
  { id: "complete", label: "Complete" },
  { id: "missed-call", label: "Missed-call" },
];

function useLiveClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  return now.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function PharmacyDashboard({ onLogout }: { onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<QueueStage>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const liveTime = useLiveClock();
  const { data, isLoading } = useQuery({
    queryKey: ["pharmacy-queue"],
    queryFn: getPharmacyQueue,
    refetchInterval: 15000,
  });

  const patients = useMemo(() => data?.patients ?? [], [data?.patients]);
  const filteredPatients = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return patients.filter((patient) => {
      const matchesTab = activeTab === "all" || patient.stage === activeTab;
      const matchesSearch = !keyword || [patient.vn, patient.hn, patient.name].some((value) => value.toLowerCase().includes(keyword));
      return matchesTab && matchesSearch;
    });
  }, [activeTab, patients, search]);

  const selectedPatient = selectedId ? patients.find((patient) => patient.id === selectedId) : undefined;
  const selectedPanel =
    selectedPatient?.stage === "checking"
      ? "checking"
      : selectedPatient?.stage === "dispensing"
        ? "dispensing"
        : selectedPatient?.stage === "matching"
          ? "matching"
          : "verify";

  function selectTab(tabId: QueueStage) {
    setActiveTab(tabId);
    setSelectedId(null);
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-slate-100 text-slate-900">
      <header className="relative z-30 shrink-0 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex min-h-20 flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-100">
                <Activity className="h-7 w-7" />
              </div>
              <div>
                <div className="text-lg font-black text-slate-950">PharmAuto OPD</div>
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Verify Workstation</div>
              </div>
            </div>
            <Button className="lg:hidden" onClick={onLogout} size="icon" variant="ghost">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex gap-2">
              <Badge className="bg-blue-100 text-blue-700">7 Verify</Badge>
              <Badge className="bg-red-100 text-red-600">2 Stat</Badge>
              <Badge className="bg-yellow-100 text-amber-700">1 Pending</Badge>
            </div>
            <div className="hidden items-center gap-2 font-mono text-lg font-black tracking-[0.2em] text-slate-800 sm:flex">
              <Clock3 className="h-4 w-4 text-slate-400" />
              {liveTime}
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              <span className="font-sans text-xs tracking-normal text-slate-400">LIVE</span>
            </div>
            <div className="relative min-w-0 sm:w-72">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <Input className="pl-10" placeholder="ค้นหา VN, HN, ชื่อ" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
            <Button className="hidden lg:inline-flex" onClick={onLogout} variant="ghost">
              <LogOut className="h-4 w-4" />
              ออก
            </Button>
          </div>
        </div>

        <nav className="overflow-x-auto border-t border-slate-100 bg-white px-3">
          <div className="flex min-w-max gap-1">
            {tabs.map((tab) => (
              <button
                className={cn(
                  "relative h-14 px-4 text-sm font-black text-slate-500 transition hover:text-blue-600",
                  activeTab === tab.id && "text-blue-700",
                )}
                key={tab.id}
                onClick={() => selectTab(tab.id)}
                type="button"
              >
                {tab.label}
                <span className="ml-2 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">{data?.summary[tab.id] ?? 0}</span>
                {activeTab === tab.id ? <span className="absolute bottom-0 left-2 right-2 h-1 rounded-t-full bg-blue-600" /> : null}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <div className="grid min-h-0 flex-1 overflow-hidden bg-white">
        <section className="h-full min-h-0 overflow-hidden bg-white">
          <QueueTable isLoading={isLoading} patients={filteredPatients} selectedId={selectedPatient?.id} onClose={() => setSelectedId(null)} onSelect={setSelectedId} />
          <MobileQueueList patients={filteredPatients} selectedId={selectedPatient?.id} onSelect={setSelectedId} />
        </section>
      </div>
      {selectedPatient && selectedPanel === "checking" ? (
        <CheckingCheckoutPopup patient={selectedPatient} onClose={() => setSelectedId(null)} />
      ) : null}
      {selectedPatient && selectedPanel === "dispensing" ? (
        <DispensingPopup patient={selectedPatient} onClose={() => setSelectedId(null)} />
      ) : null}
      {selectedPatient && selectedPanel === "matching" ? (
        <MatchingPopup patient={selectedPatient} onClose={() => setSelectedId(null)} />
      ) : null}
      {selectedPatient && selectedPanel === "verify" ? <PatientPanel patient={selectedPatient} onClose={() => setSelectedId(null)} /> : null}
    </main>
  );
}
