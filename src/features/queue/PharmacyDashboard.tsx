"use client";

import { useQuery } from "@tanstack/react-query";
import { BarChart3, ClipboardCheck, FileWarning, ListChecks, Pill } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { OperationsDashboard } from "@/features/dashboard/OperationsDashboard";
import { DispensingQueueScreen } from "@/features/dispensing/DispensingQueueScreen";
import { MedicationErrorScreen } from "@/features/medication-error/MedicationErrorScreen";
import { SidebarNav } from "@/features/shell/SidebarNav";
import { WorkspaceHeader } from "@/features/shell/WorkspaceHeader";
import type { WorkspaceNavItem, WorkspaceScreen } from "@/features/shell/shell-types";
import { MatchingCheckingScreen } from "@/features/workflow/MatchingCheckingScreen";
import { getPharmacyQueue } from "@/lib/pharmacy-api";
import { cn } from "@/lib/utils";
import type { QueueStage } from "@/types/pharmacy";
import { CheckingCheckoutPopup } from "@/features/checking/CheckingCheckoutPopup";
import { DispensingPopup } from "@/features/dispensing/DispensingPopup";
import { MatchingPopup } from "@/features/matching/MatchingPopup";
import { PatientPanel } from "@/features/verify/PatientPanel";
import { MobileQueueList } from "./MobileQueueList";
import { QueueTable } from "./QueueTable";

const workspaceItems: WorkspaceNavItem[] = [
  { id: "verify", label: "Verify", subtitle: "Verify Workstation", icon: ClipboardCheck },
  { id: "matching", label: "จัด/ตรวจ", subtitle: "Matching & Checking", icon: ListChecks },
  { id: "dispensing", label: "จ่ายยา", subtitle: "Dispensing & Queue", icon: Pill },
  { id: "dashboard", label: "Dashboard", subtitle: "Operations Dashboard", icon: BarChart3 },
  { id: "me", label: "ME Report", subtitle: "Medication Error Report", icon: FileWarning },
];

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
  const [activeScreen, setActiveScreen] = useState<WorkspaceScreen>("verify");
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

  function selectScreen(screen: WorkspaceScreen) {
    setActiveScreen(screen);
    setSelectedId(null);
  }

  const activeItem = workspaceItems.find((item) => item.id === activeScreen) ?? workspaceItems[0];

  return (
    <main className="flex h-screen overflow-hidden bg-[#eef1f5] pb-16 text-[#1e2a3a] md:pb-0">
      <SidebarNav activeScreen={activeScreen} items={workspaceItems} onSelect={selectScreen} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <WorkspaceHeader activeItem={activeItem} liveTime={liveTime} search={search} summary={data?.summary} onLogout={onLogout} onSearch={setSearch} />

        <div className="min-h-0 flex-1 overflow-hidden">
          {activeScreen === "verify" ? (
            <div className="flex h-full min-h-0 flex-col bg-white">
              <nav className="shrink-0 overflow-x-auto border-b border-[#e6eaf0] bg-white px-[26px]">
                <div className="flex min-w-max gap-1">
                  {tabs.map((tab) => (
                    <button
                      className={cn(
                        "relative h-[54px] px-4 text-[14.5px] font-semibold text-[#6a7889] transition hover:text-[#2f6bf3]",
                        activeTab === tab.id && "text-[#2f6bf3]",
                      )}
                      key={tab.id}
                      onClick={() => selectTab(tab.id)}
                      type="button"
                    >
                      {tab.label}
                      <span className={cn("ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-[7px] px-1.5 text-[11.5px] font-bold", activeTab === tab.id ? "bg-[#e7efff] text-[#2f6bf3]" : "bg-[#eef1f5] text-[#8a97a8]")}>{data?.summary[tab.id] ?? 0}</span>
                      {activeTab === tab.id ? <span className="absolute bottom-[-1px] left-2 right-2 h-[2.5px] rounded-t-full bg-[#2f6bf3]" /> : null}
                    </button>
                  ))}
                </div>
              </nav>

              <section className="h-full min-h-0 overflow-hidden bg-white">
                <QueueTable isLoading={isLoading} patients={filteredPatients} selectedId={selectedPatient?.id} onClose={() => setSelectedId(null)} onSelect={setSelectedId} />
                <MobileQueueList patients={filteredPatients} selectedId={selectedPatient?.id} onSelect={setSelectedId} />
              </section>
            </div>
          ) : null}

          {activeScreen === "matching" ? <MatchingCheckingScreen search={search} /> : null}
          {activeScreen === "dispensing" ? <DispensingQueueScreen search={search} /> : null}
          {activeScreen === "dashboard" ? <OperationsDashboard /> : null}
          {activeScreen === "me" ? <MedicationErrorScreen search={search} /> : null}
        </div>

        {activeScreen === "verify" && selectedPatient && selectedPanel === "checking" ? (
          <CheckingCheckoutPopup patient={selectedPatient} onClose={() => setSelectedId(null)} />
        ) : null}
        {activeScreen === "verify" && selectedPatient && selectedPanel === "dispensing" ? (
          <DispensingPopup patient={selectedPatient} onClose={() => setSelectedId(null)} />
        ) : null}
        {activeScreen === "verify" && selectedPatient && selectedPanel === "matching" ? (
          <MatchingPopup patient={selectedPatient} onClose={() => setSelectedId(null)} />
        ) : null}
        {activeScreen === "verify" && selectedPatient && selectedPanel === "verify" ? <PatientPanel patient={selectedPatient} onClose={() => setSelectedId(null)} /> : null}
      </div>
    </main>
  );
}
