"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, BarChart3, ChevronLeft, ChevronRight, ClipboardCheck, FileWarning, PackageCheck, Pill, RefreshCw, ScanBarcode } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { OperationsDashboard } from "@/features/dashboard/OperationsDashboard";
import { DispensingQueueScreen } from "@/features/dispensing/DispensingQueueScreen";
import { MedicationErrorScreen } from "@/features/medication-error/MedicationErrorScreen";
import { SidebarNav } from "@/features/shell/SidebarNav";
import { WorkspaceHeader, type WorkspaceDateRange } from "@/features/shell/WorkspaceHeader";
import type { WorkspaceNavItem, WorkspaceScreen } from "@/features/shell/shell-types";
import { MatchingCheckingScreen } from "@/features/workflow/MatchingCheckingScreen";
import { getPharmacyQueue } from "@/lib/pharmacy-api";
import { cn } from "@/lib/utils";
import { getVerifyPrescriptionQueue, VERIFY_VISITS_PER_PAGE } from "@/lib/verify-prescriptions-api";
import type { QueueStage, QueueSummary } from "@/types/pharmacy";
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
  const [verifyPage, setVerifyPage] = useState(1);
  const [dateRange, setDateRange] = useState<WorkspaceDateRange>(() => {
    const today = getBangkokDate();
    return { fromDate: today, toDate: today };
  });
  const liveTime = useLiveClock();
  const { data: mockQueue, isLoading: isMockQueueLoading } = useQuery({
    queryKey: ["pharmacy-queue"],
    queryFn: getPharmacyQueue,
    refetchInterval: 15000,
  });
  const {
    data: verifyQueue,
    error: verifyApiError,
    isError: isVerifyApiError,
    isFetching: isVerifyFetching,
    isLoading: isVerifyLoading,
    refetch: refetchVerify,
  } = useQuery({
    queryKey: ["verify-prescriptions", dateRange.fromDate, dateRange.toDate],
    queryFn: ({ signal }) => getVerifyPrescriptionQueue(dateRange, signal),
    enabled: activeScreen === "verify" && Boolean(dateRange.fromDate && dateRange.toDate),
    placeholderData: (previousData) => previousData,
    refetchInterval: 30000,
    retry: 1,
  });

  const patients = useMemo(() => {
    const verifyPatients = verifyQueue?.patients ?? [];
    const nonVerifyPatients = (mockQueue?.patients ?? []).filter((patient) => patient.stage !== "verify");
    return [...verifyPatients, ...nonVerifyPatients];
  }, [mockQueue?.patients, verifyQueue?.patients]);
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
  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / VERIFY_VISITS_PER_PAGE));
  const currentPage = Math.min(verifyPage, totalPages);
  const visiblePatients = useMemo(
    () => filteredPatients.slice((currentPage - 1) * VERIFY_VISITS_PER_PAGE, currentPage * VERIFY_VISITS_PER_PAGE),
    [currentPage, filteredPatients],
  );
  const summary = useMemo<QueueSummary>(() => {
    const fallback = createEmptyQueueSummary();
    const base = mockQueue?.summary ?? fallback;
    const nonVerifyCount = (mockQueue?.patients ?? []).filter((patient) => patient.stage !== "verify").length;

    return {
      ...base,
      all: (verifyQueue?.totalVisits ?? 0) + nonVerifyCount,
      verify: verifyQueue?.totalPrescriptions ?? 0,
    };
  }, [mockQueue?.patients, mockQueue?.summary, verifyQueue?.totalPrescriptions, verifyQueue?.totalVisits]);
  const isCurrentQueueLoading = activeTab === "verify" || activeTab === "all" ? isVerifyLoading : isMockQueueLoading;
  const showVerifyError = activeTab === "verify" && isVerifyApiError;

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
        doctor: selectedPrescription.doctor ?? selectedPatient.doctor,
        doctorCode: selectedPrescription.doctorCode ?? selectedPatient.doctorCode,
        clinicCode: selectedPrescription.clinicCode ?? selectedPatient.clinicCode,
        wardName: selectedPrescription.wardName ?? selectedPatient.wardName,
        prescriptionCreatedAt: selectedPrescription.createdAt ?? selectedPatient.prescriptionCreatedAt,
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
    setVerifyPage(1);
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

  function updateDateRange(nextDateRange: WorkspaceDateRange) {
    setDateRange(nextDateRange);
    setVerifyPage(1);
    closeSelectedItem();
  }

  function updateSearch(value: string) {
    setSearch(value);
    setVerifyPage(1);
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
        <WorkspaceHeader
          activeItem={activeItem}
          dateRange={dateRange}
          liveTime={liveTime}
          search={search}
          summary={summary}
          onDateRangeChange={updateDateRange}
          onLogout={onLogout}
          onSearch={updateSearch}
        />

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
                      <span className={cn("ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-[7px] px-1.5 text-[11.5px] font-bold", activeTab === tab.id ? "bg-[#e7efff] text-[#2f6bf3]" : "bg-[#eef1f5] text-[#8a97a8]")}>{summary[tab.id]}{tab.id === "verify" ? " PN" : ""}</span>
                      {activeTab === tab.id ? <span className="absolute bottom-[-1px] left-2 right-2 h-[2.5px] rounded-t-full bg-[#2f6bf3]" /> : null}
                    </button>
                  ))}
                </div>
              </nav>

              <section className="flex h-full min-h-0 flex-col overflow-hidden bg-white">
                {showVerifyError ? (
                  <VerifyApiErrorState error={verifyApiError} onRetry={() => void refetchVerify()} />
                ) : (
                  <>
                    <div className="min-h-0 flex-1 overflow-hidden">
                      <QueueTable
                        isLoading={isCurrentQueueLoading}
                        patients={visiblePatients}
                        selectedId={selectedPatient?.id}
                        sentToMatchingPatientIds={sentToMatchingPatientIds}
                        verifiedPrescriptionIds={verifiedPrescriptionIds}
                        onSelect={selectQueueItem}
                        onSendMatching={sendPatientToMatching}
                      />
                      <MobileQueueList
                        patients={visiblePatients}
                        selectedId={selectedPatient?.id}
                        sentToMatchingPatientIds={sentToMatchingPatientIds}
                        verifiedPrescriptionIds={verifiedPrescriptionIds}
                        onSelect={selectQueueItem}
                        onSendMatching={sendPatientToMatching}
                      />
                    </div>
                    {filteredPatients.length > 0 ? (
                      <VerifyPagination
                        isFetching={isVerifyFetching && (activeTab === "verify" || activeTab === "all")}
                        page={currentPage}
                        totalItems={filteredPatients.length}
                        totalPages={totalPages}
                        onPageChange={setVerifyPage}
                      />
                    ) : null}
                  </>
                )}
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

function VerifyPagination({
  isFetching,
  page,
  totalItems,
  totalPages,
  onPageChange,
}: {
  isFetching: boolean;
  page: number;
  totalItems: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const firstItem = (page - 1) * VERIFY_VISITS_PER_PAGE + 1;
  const lastItem = Math.min(page * VERIFY_VISITS_PER_PAGE, totalItems);

  return (
    <div className="flex shrink-0 flex-col gap-2 border-t border-slate-200 bg-white px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="font-bold text-slate-500">
        แสดง VN {firstItem}–{lastItem} จาก {totalItems} VN
        {isFetching ? <span className="ml-2 text-blue-600">กำลังอัปเดต...</span> : null}
      </div>
      <div className="flex items-center gap-2">
        <Button aria-label="หน้าก่อนหน้า" className="h-9 w-9 rounded-xl" disabled={page <= 1} onClick={() => onPageChange(page - 1)} size="icon" variant="outline">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-24 text-center font-mono text-sm font-black text-slate-700">หน้า {page}/{totalPages}</span>
        <Button aria-label="หน้าถัดไป" className="h-9 w-9 rounded-xl" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} size="icon" variant="outline">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function VerifyApiErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center shadow-sm">
        <AlertTriangle className="mx-auto h-9 w-9 text-rose-600" />
        <h2 className="mt-3 text-lg font-black text-rose-900">โหลดข้อมูล Verify prescriptions ไม่สำเร็จ</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-rose-700">{readQueryError(error)}</p>
        <p className="mt-1 text-xs font-bold text-rose-500">ตรวจสอบว่า Backend ทำงานที่ localhost:3001 และอนุญาต CORS จาก Frontend</p>
        <Button className="mt-5 rounded-xl bg-blue-600 text-white hover:bg-blue-700" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" />
          ลองใหม่
        </Button>
      </div>
    </div>
  );
}

function readQueryError(error: unknown) {
  return error instanceof Error ? error.message : "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";
}

function createEmptyQueueSummary(): QueueSummary {
  return {
    all: 0,
    verify: 0,
    picking: 0,
    matching: 0,
    checking: 0,
    dispensing: 0,
    pending: 0,
    complete: 0,
    "missed-call": 0,
  };
}

function getBangkokDate() {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Bangkok",
    year: "numeric",
  }).format(new Date());
}
