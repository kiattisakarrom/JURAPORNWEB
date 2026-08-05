"use client";

import { useQuery } from "@tanstack/react-query";
import { BarChart3, ClipboardCheck, FileWarning, PackageCheck, Pill, ScanBarcode } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
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
  { id: "matching", label: "Matching", subtitle: "Matching Workstation", icon: ScanBarcode },
  { id: "checking", label: "Checking", subtitle: "Checking Workstation", icon: PackageCheck },
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
  const [activeTab, setActiveTab] = useState<QueueStage>("verify");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedPrescriptionId, setSelectedPrescriptionId] = useState<string | null>(null);
  const [verifiedPrescriptionIds, setVerifiedPrescriptionIds] = useState<Set<string>>(() => new Set());
  const [sentToMatchingPatientIds, setSentToMatchingPatientIds] = useState<Set<string>>(() => new Set());
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
      const matchesSearch =
        !keyword ||
        [patient.vn, patient.hn, patient.name].some((value) => value.toLowerCase().includes(keyword)) ||
        patient.prescriptions?.some((prescription) =>
          [`pn ${prescription.pn}`, `pn-${patient.vn}-${prescription.pn}`, prescription.pn].some((value) => value.includes(keyword)),
        );
      return matchesTab && matchesSearch;
    });
  }, [activeTab, patients, search]);

  const selectedPatient = selectedId ? patients.find((patient) => patient.id === selectedId) : undefined;
  const selectedPrescription = selectedPatient?.prescriptions?.find((prescription) => prescription.id === selectedPrescriptionId);
  const selectedPatientForPanel = selectedPatient && selectedPrescription
    ? {
        ...selectedPatient,
        alerts: selectedPrescription.alerts,
        drugs: selectedPrescription.drugs,
        issue: selectedPrescription.issue,
        medicationCount: selectedPrescription.drugs.length,
        time: selectedPrescription.time,
      }
    : selectedPatient;
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
    setSelectedPrescriptionId(null);
  }

  function selectScreen(screen: WorkspaceScreen) {
    setActiveScreen(screen);
    setSelectedId(null);
    setSelectedPrescriptionId(null);
  }

  function selectQueueItem(id: string, prescriptionId?: string) {
    setSelectedId(id);
    setSelectedPrescriptionId(prescriptionId ?? null);
  }

  function closeSelectedItem() {
    setSelectedId(null);
    setSelectedPrescriptionId(null);
  }

  function verifySelectedPrescription() {
    if (!selectedPrescription) return;

    setVerifiedPrescriptionIds((current) => new Set(current).add(selectedPrescription.id));
    toast.success(`PN ${selectedPrescription.pn} Verify และส่ง MDR แล้ว`);
    closeSelectedItem();
  }

  function sendPatientToMatching(patientId: string) {
    const patient = patients.find((item) => item.id === patientId);
    if (!patient) return;

    setSentToMatchingPatientIds((current) => new Set(current).add(patientId));
    toast.success(`VN ${patient.vn} Verify แล้ว`);
  }

  const activeItem = workspaceItems.find((item) => item.id === activeScreen) ?? workspaceItems[0];

  return (
    <main className="flex h-dvh min-h-0 overflow-hidden bg-[#eef1f5] pb-[calc(4rem+env(safe-area-inset-bottom))] text-[#1e2a3a] md:pb-0">
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
                      <span className={cn("ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-[7px] px-1.5 text-[11.5px] font-bold", activeTab === tab.id ? "bg-[#e7efff] text-[#2f6bf3]" : "bg-[#eef1f5] text-[#8a97a8]")}>{data?.summary[tab.id] ?? 0}{tab.id === "verify" ? " PN" : ""}</span>
                      {activeTab === tab.id ? <span className="absolute bottom-[-1px] left-2 right-2 h-[2.5px] rounded-t-full bg-[#2f6bf3]" /> : null}
                    </button>
                  ))}
                </div>
              </nav>

              <section className="h-full min-h-0 overflow-hidden bg-white">
                <QueueTable
                  isLoading={isLoading}
                  patients={filteredPatients}
                  selectedId={selectedPatient?.id}
                  sentToMatchingPatientIds={sentToMatchingPatientIds}
                  verifiedPrescriptionIds={verifiedPrescriptionIds}
                  onSelect={selectQueueItem}
                  onSendMatching={sendPatientToMatching}
                />
                <MobileQueueList
                  patients={filteredPatients}
                  selectedId={selectedPatient?.id}
                  sentToMatchingPatientIds={sentToMatchingPatientIds}
                  verifiedPrescriptionIds={verifiedPrescriptionIds}
                  onSelect={selectQueueItem}
                  onSendMatching={sendPatientToMatching}
                />
              </section>
            </div>
          ) : null}

          {activeScreen === "matching" || activeScreen === "checking" ? (
            <MatchingCheckingScreen
              search={search}
              stage={activeScreen}
              onOpenChecking={() => selectScreen("checking")}
            />
          ) : null}
          {activeScreen === "dispensing" ? <DispensingQueueScreen search={search} /> : null}
          {activeScreen === "dashboard" ? <OperationsDashboard /> : null}
          {activeScreen === "me" ? <MedicationErrorScreen search={search} /> : null}
        </div>

        {activeScreen === "verify" && selectedPatient && selectedPanel === "checking" ? (
          <CheckingCheckoutPopup patient={selectedPatient} onClose={closeSelectedItem} />
        ) : null}
        {activeScreen === "verify" && selectedPatient && selectedPanel === "dispensing" ? (
          <DispensingPopup patient={selectedPatient} onClose={closeSelectedItem} />
        ) : null}
        {activeScreen === "verify" && selectedPatient && selectedPanel === "matching" ? (
          <MatchingPopup patient={selectedPatient} onClose={closeSelectedItem} />
        ) : null}
        {activeScreen === "verify" && selectedPatientForPanel && selectedPanel === "verify" && (!selectedPatient?.prescriptions?.length || selectedPrescription) ? (
          <PatientPanel patient={selectedPatientForPanel} pn={selectedPrescription?.pn} onClose={closeSelectedItem} onVerify={verifySelectedPrescription} />
        ) : null}
      </div>
    </main>
  );
}
