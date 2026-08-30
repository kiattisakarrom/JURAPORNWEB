"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, BarChart3, ChevronLeft, ChevronRight, ClipboardCheck, FileWarning, PackageCheck, Pill, RefreshCw, ScanBarcode } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { OperationsDashboard } from "@/features/dashboard/OperationsDashboard";
import { DispensingQueueScreen } from "@/features/dispensing/DispensingQueueScreen";
import { MedicationErrorScreen } from "@/features/medication-error/MedicationErrorScreen";
import { SidebarNav } from "@/features/shell/SidebarNav";
import { WorkspaceHeader, type WorkspaceDateRange } from "@/features/shell/WorkspaceHeader";
import type { WorkspaceNavItem, WorkspaceScreen } from "@/features/shell/shell-types";
import { MatchingCheckingScreen } from "@/features/workflow/MatchingCheckingScreen";
import { cn } from "@/lib/utils";
import {
  buildVerifyPrescriptionQueue,
  getVerifyPrescriptionBackgroundPages,
  getVerifyPrescriptionQueueFirstPage,
  VERIFY_VISITS_PER_PAGE,
} from "@/lib/verify-prescriptions-api";
import {
  claimVerifyLock,
  createIdempotencyKey,
  getPackages,
  getPackageWorkflows,
  getVerifySessionId,
  heartbeatVerifyLock,
  releaseVerifyLock,
  returnPackageWorkflowToVerify,
  setPackageWorkflowPending,
  transitionPackage,
  verifyPackagePrescription,
} from "@/lib/package-workflow-api";
import { mergeVerifyQueueWithPackageWorkflow } from "@/lib/package-workflow-adapter";
import type { PatientQueueItem, QueueStage, QueueSummary } from "@/types/pharmacy";
import { CheckingCheckoutPopup } from "@/features/checking/CheckingCheckoutPopup";
import { DispensingPopup } from "@/features/dispensing/DispensingPopup";
import { MatchingPopup } from "@/features/matching/MatchingPopup";
import { PickingPrescriptionPopup } from "@/features/picking/PickingPrescriptionPopup";
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
  const queryClient = useQueryClient();
  const [activeScreen, setActiveScreen] = useState<WorkspaceScreen>("verify");
  const [activeTab, setActiveTab] = useState<QueueStage>("verify");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedPrescriptionId, setSelectedPrescriptionId] = useState<string | null>(null);
  const [selectedVerifyAccess, setSelectedVerifyAccess] = useState<{
    workflowId: string | null;
    lockToken: string | null;
    sessionId: string;
    isReadOnly: boolean;
    isLoading: boolean;
    ownerName?: string | null;
  } | null>(null);
  const verifyAccessRequestRef = useRef(0);
  const [verifyPage, setVerifyPage] = useState(1);
  const [dateRange, setDateRange] = useState<WorkspaceDateRange>(() => {
    const today = getBangkokDate();
    return { fromDate: today, toDate: today };
  });
  const liveTime = useLiveClock();
  const {
    data: verifyFirstPage,
    error: verifyApiError,
    isError: isVerifyApiError,
    isFetching: isVerifyFetching,
    isLoading: isVerifyLoading,
    refetch: refetchVerify,
  } = useQuery({
    queryKey: ["verify-prescriptions", dateRange.fromDate, dateRange.toDate],
    queryFn: ({ signal }) => getVerifyPrescriptionQueueFirstPage(dateRange, signal),
    enabled: activeScreen === "verify" && Boolean(dateRange.fromDate && dateRange.toDate),
    refetchInterval: 30000,
    retry: 1,
  });
  const verifyApiTotalPages = verifyFirstPage?.PAGINATION.TOTAL_PAGES ?? 0;
  const {
    data: verifyBackgroundPages,
    isError: isVerifyBackgroundError,
    isFetching: isVerifyBackgroundFetching,
    refetch: refetchVerifyBackground,
  } = useQuery({
    queryKey: [
      "verify-prescriptions-background",
      dateRange.fromDate,
      dateRange.toDate,
      verifyFirstPage?.PAGINATION.TOTAL_VISITS ?? 0,
    ],
    queryFn: ({ signal }) => getVerifyPrescriptionBackgroundPages(dateRange, verifyApiTotalPages, signal),
    enabled: activeScreen === "verify" && verifyApiTotalPages > 1,
    retry: 1,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const {
    data: packageWorkflows = [],
    error: packageWorkflowError,
    isError: isPackageWorkflowError,
    isLoading: isPackageWorkflowLoading,
  } = useQuery({
    queryKey: ["package-workflows", dateRange.fromDate, dateRange.toDate],
    queryFn: () => getPackageWorkflows(dateRange),
    enabled: activeScreen === "verify" && Boolean(dateRange.fromDate && dateRange.toDate),
    refetchInterval: 15000,
    retry: 1,
  });
  const {
    data: packages = [],
    error: packagesError,
    isError: isPackagesError,
    isLoading: isPackagesLoading,
  } = useQuery({
    queryKey: ["packages", dateRange.fromDate, dateRange.toDate],
    queryFn: () => getPackages(dateRange),
    enabled: activeScreen === "verify" && Boolean(dateRange.fromDate && dateRange.toDate),
    refetchInterval: 15000,
    retry: 1,
  });

  const verifyQueue = useMemo(() => buildVerifyPrescriptionQueue(
    verifyFirstPage
      ? [verifyFirstPage, ...(verifyBackgroundPages ?? [])]
      : [],
  ), [verifyBackgroundPages, verifyFirstPage]);
  const verifyBackgroundStatus: "loading" | "complete" | "error" = isVerifyBackgroundFetching
    ? "loading"
    : isVerifyBackgroundError
      ? "error"
      : verifyFirstPage && (verifyApiTotalPages <= 1 || verifyBackgroundPages)
        ? "complete"
        : "loading";
  const patients = useMemo(() => {
    return mergeVerifyQueueWithPackageWorkflow(verifyQueue?.patients ?? [], packageWorkflows, packages);
  }, [packageWorkflows, packages, verifyQueue?.patients]);
  const verifiedPrescriptionIds = useMemo(
    () => new Set(patients.flatMap((patient) => patient.prescriptions
      ?.filter((prescription) => prescription.verifyStatus === "VERIFIED_WAITING" || prescription.verifyStatus === "PACKAGED")
      .map((prescription) => prescription.id) ?? [])),
    [patients],
  );
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
    const next = createEmptyQueueSummary();
    next.all = patients.length;
    patients.forEach((patient) => {
      next[patient.stage] += patient.stage === "verify" ? patient.prescriptions?.length ?? 1 : 1;
    });
    return next;
  }, [patients]);
  const isCurrentQueueLoading = activeTab === "verify" || activeTab === "all"
    ? isVerifyLoading
    : isPackageWorkflowLoading || isPackagesLoading;
  const showVerifyError = activeTab === "verify" && (isVerifyApiError || isPackageWorkflowError || isPackagesError);

  const selectedPatient = selectedId ? patients.find((patient) => patient.id === selectedId) : undefined;
  const selectedPrescription = selectedPatient?.prescriptions?.find((prescription) => prescription.id === selectedPrescriptionId);
  const selectedPatientForPanel = selectedPatient && selectedPrescription
    ? {
        ...selectedPatient,
        alerts: selectedPrescription.alerts,
        clinicalAlerts: selectedPrescription.clinicalAlerts,
        drugs: selectedPrescription.drugs,
        prescriptions: [selectedPrescription],
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
          : selectedPatient?.stage === "picking"
            ? "picking"
          : "verify";

  useEffect(() => {
    if (!selectedVerifyAccess?.workflowId || !selectedVerifyAccess.lockToken || selectedVerifyAccess.isReadOnly) return;
    const { workflowId, lockToken, sessionId } = selectedVerifyAccess;
    const timer = window.setInterval(() => {
      void heartbeatVerifyLock(workflowId, { lockToken, sessionId })
        .then(() => queryClient.invalidateQueries({ queryKey: ["package-workflows"] }))
        .catch((error) => {
          setSelectedVerifyAccess((current) => current ? { ...current, lockToken: null, isReadOnly: true } : current);
          toast.error(`ล็อก Verify หมดอายุ: ${readQueryError(error)}`);
        });
    }, 30000);

    return () => window.clearInterval(timer);
  }, [queryClient, selectedVerifyAccess]);

  function selectTab(tabId: QueueStage) {
    setActiveTab(tabId);
    setVerifyPage(1);
    closeSelectedItem();
  }

  function selectScreen(screen: WorkspaceScreen) {
    setActiveScreen(screen);
    closeSelectedItem();
  }

  function selectQueueItem(id: string, prescriptionId?: string) {
    const canReuseVerifyAccess = selectedPatient?.id === id && Boolean(selectedVerifyAccess?.lockToken);
    verifyAccessRequestRef.current += 1;
    if (!canReuseVerifyAccess && selectedVerifyAccess?.workflowId && selectedVerifyAccess.lockToken) {
      void releaseVerifyLock(selectedVerifyAccess.workflowId, {
        lockToken: selectedVerifyAccess.lockToken,
        sessionId: selectedVerifyAccess.sessionId,
      }).catch(() => undefined);
    }
    setSelectedId(id);
    setSelectedPrescriptionId(prescriptionId ?? null);
    const patient = patients.find((candidate) => candidate.id === id);
    if (patient?.stage === "verify" && prescriptionId) {
      if (!canReuseVerifyAccess) void prepareVerifyAccess(patient);
    } else {
      setSelectedVerifyAccess(null);
    }
  }

  function closeSelectedItem() {
    verifyAccessRequestRef.current += 1;
    const access = selectedVerifyAccess;
    setSelectedId(null);
    setSelectedPrescriptionId(null);
    setSelectedVerifyAccess(null);
    if (access?.workflowId && access.lockToken) {
      void releaseVerifyLock(access.workflowId, { lockToken: access.lockToken, sessionId: access.sessionId })
        .then(() => refreshPackageData())
        .catch(() => undefined);
    }
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

  async function refreshPackageData() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["package-workflows"] }),
      queryClient.invalidateQueries({ queryKey: ["packages"] }),
      queryClient.invalidateQueries({ queryKey: ["package-baskets"] }),
      queryClient.invalidateQueries({ queryKey: ["dispensing-packages"] }),
    ]);
  }

  async function prepareVerifyAccess(patient: PatientQueueItem) {
    const requestId = ++verifyAccessRequestRef.current;
    const sessionId = getVerifySessionId();
    if (!patient.date) {
      setSelectedVerifyAccess({ workflowId: patient.workflowId ?? null, lockToken: null, sessionId, isReadOnly: true, isLoading: false });
      return;
    }
    if (patient.activePackageId) {
      setSelectedVerifyAccess({ workflowId: patient.workflowId ?? null, lockToken: null, sessionId, isReadOnly: true, isLoading: false, ownerName: "รอรับแพ็กเกจยารอบปัจจุบัน" });
      return;
    }

    setSelectedVerifyAccess({ workflowId: patient.workflowId ?? null, lockToken: null, sessionId, isReadOnly: true, isLoading: true });
    try {
      const workflow = await claimVerifyLock({
        visitDate: patient.date.slice(0, 10),
        visitNumber: patient.vn,
        sessionId,
        ownerName: "Pharmacist",
        workstationCode: "VERIFY-WEB",
      });
      if (verifyAccessRequestRef.current !== requestId) {
        if (workflow.VERIFY_LOCK.LOCK_TOKEN) {
          await releaseVerifyLock(workflow.WORKFLOW_ID, {
            lockToken: workflow.VERIFY_LOCK.LOCK_TOKEN,
            sessionId,
          }).catch(() => undefined);
        }
        return;
      }
      setSelectedVerifyAccess({
        workflowId: workflow.WORKFLOW_ID,
        lockToken: workflow.VERIFY_LOCK.LOCK_TOKEN,
        sessionId,
        isReadOnly: !workflow.VERIFY_LOCK.LOCK_TOKEN,
        isLoading: false,
        ownerName: workflow.VERIFY_LOCK.OWNER_NAME,
      });
      await refreshPackageData();
    } catch (error) {
      if (verifyAccessRequestRef.current !== requestId) return;
      setSelectedVerifyAccess({
        workflowId: patient.workflowId ?? null,
        lockToken: null,
        sessionId,
        isReadOnly: true,
        isLoading: false,
        ownerName: patient.verifyLock?.ownerName,
      });
      toast.error(`เปิดแบบอ่านอย่างเดียว: ${readQueryError(error)}`);
    }
  }

  async function verifySelectedPrescription(input: { mode: "NORMAL" | "URGENT"; selectedDrugIds: string[]; note: string }) {
    if (!selectedPrescription || !selectedVerifyAccess?.workflowId || !selectedVerifyAccess.lockToken) return;
    const patient = selectedPatientForPanel;
    if (!patient?.date) return;
    try {
      const selectedDrugIds = new Set(input.selectedDrugIds);
      const selectedItems = selectedPrescription.drugs
        .filter((drug) => selectedDrugIds.has(drug.id) && drug.MEDICINECODE && drug.itemSequence)
        .map((drug) => ({ medicineCode: drug.MEDICINECODE!, itemSeq: drug.itemSequence! }));
      const result = await verifyPackagePrescription(selectedVerifyAccess.workflowId, {
        lockToken: selectedVerifyAccess.lockToken,
        sessionId: selectedVerifyAccess.sessionId,
        prescriptionNumber: selectedPrescription.pn,
        mode: input.mode,
        packagePriority: input.mode === "URGENT" ? "URGENT" : "NORMAL",
        selectedItems: input.mode === "URGENT" ? selectedItems : undefined,
        note: input.note || undefined,
        actorName: "Pharmacist",
        idempotencyKey: createIdempotencyKey(),
      });
      await refreshPackageData();
      if (result.PACKAGE_CREATED) {
        toast.success(`${input.mode === "URGENT" ? "สร้างแพ็กเกจยาด่วน" : "Verify ครบและส่งไป Picking"} แล้ว`);
      } else {
        toast.success(`PN ${selectedPrescription.pn} Verify แล้ว รออีก ${result.WAITING_PRESCRIPTIONS.length} PN`);
      }
      closeSelectedItem();
    } catch (error) {
      toast.error(readQueryError(error));
    }
  }

  async function runPrimaryAction(patient: PatientQueueItem) {
    try {
      if (patient.stage === "verify") {
        const prescription = patient.prescriptions?.find((item) => item.verifyStatus !== "PACKAGED") ?? patient.prescriptions?.[0];
        if (prescription) selectQueueItem(patient.id, prescription.id);
        return;
      } else if (patient.stage === "picking" && patient.packageId) {
        await transitionPackage(patient.packageId, "SEND_TO_MATCHING");
        toast.success(`VN ${patient.vn} ส่งไป Matching แล้ว (MVP ข้ามการรอ Location)`);
      }
      await refreshPackageData();
    } catch (error) {
      toast.error(readQueryError(error));
    }
  }

  async function runPendingAction(patient: PatientQueueItem) {
    try {
      if (patient.stage === "pending" && patient.workflowId) {
        await returnPackageWorkflowToVerify(patient.workflowId, "Pharmacist");
        toast.success(`VN ${patient.vn} กลับหน้า Verify แล้ว`);
      } else if (patient.stage === "verify" && patient.date) {
        await setPackageWorkflowPending({
          visitDate: patient.date.slice(0, 10),
          visitNumber: patient.vn,
          reasonText: "ส่ง Pending จากคิว Verify",
          actorName: "Pharmacist",
        });
        toast.success(`VN ${patient.vn} ส่งไป Pending แล้ว`);
      }
      await refreshPackageData();
    } catch (error) {
      toast.error(readQueryError(error));
    }
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
                  <VerifyApiErrorState error={verifyApiError ?? packageWorkflowError ?? packagesError} onRetry={() => void Promise.all([refetchVerify(), refreshPackageData()])} />
                ) : (
                  <>
                    <div className="min-h-0 flex-1 overflow-hidden">
                      <QueueTable
                        isLoading={isCurrentQueueLoading}
                        patients={visiblePatients}
                        selectedId={selectedPatient?.id}
                        selectedPrescriptionId={selectedPrescriptionId ?? undefined}
                        verifiedPrescriptionIds={verifiedPrescriptionIds}
                        onPendingAction={(patient) => void runPendingAction(patient)}
                        onPrimaryAction={(patient) => void runPrimaryAction(patient)}
                        onSelect={selectQueueItem}
                      />
                      <MobileQueueList
                        patients={visiblePatients}
                        selectedId={selectedPatient?.id}
                        selectedPrescriptionId={selectedPrescriptionId ?? undefined}
                        verifiedPrescriptionIds={verifiedPrescriptionIds}
                        onPendingAction={(patient) => void runPendingAction(patient)}
                        onPrimaryAction={(patient) => void runPrimaryAction(patient)}
                        onSelect={selectQueueItem}
                      />
                    </div>
                    {filteredPatients.length > 0 ? (
                      <VerifyPagination
                        backgroundStatus={verifyBackgroundStatus}
                        isFetching={isVerifyFetching && (activeTab === "verify" || activeTab === "all")}
                        page={currentPage}
                        totalItems={filteredPatients.length}
                        totalPages={totalPages}
                        onPageChange={setVerifyPage}
                        onRetryBackground={() => void refetchVerifyBackground()}
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

        {activeScreen === "verify" && selectedPatientForPanel && selectedPrescription && selectedPanel === "checking" ? (
          <CheckingCheckoutPopup patient={selectedPatientForPanel} onClose={closeSelectedItem} />
        ) : null}
        {activeScreen === "verify" && selectedPatientForPanel && selectedPrescription && selectedPanel === "dispensing" ? (
          <DispensingPopup patient={selectedPatientForPanel} onClose={closeSelectedItem} />
        ) : null}
        {activeScreen === "verify" && selectedPatientForPanel && selectedPrescription && selectedPanel === "matching" ? (
          <MatchingPopup patient={selectedPatientForPanel} onClose={closeSelectedItem} />
        ) : null}
        {activeScreen === "verify" && selectedPatientForPanel && selectedPrescription && selectedPanel === "picking" ? (
          <PickingPrescriptionPopup
            patient={selectedPatientForPanel}
            prescriptionNumber={selectedPrescription.pn}
            onClose={closeSelectedItem}
          />
        ) : null}
        {activeScreen === "verify" && selectedPatient?.stage === "verify" && selectedPatientForPanel && selectedPanel === "verify" && (!selectedPatient?.prescriptions?.length || selectedPrescription) ? (
          <PatientPanel
            patient={selectedPatientForPanel}
            pn={selectedPrescription?.pn}
            verifyAccess={selectedVerifyAccess}
            onClose={closeSelectedItem}
            onVerify={verifySelectedPrescription}
          />
        ) : null}
      </div>
    </main>
  );
}

function VerifyPagination({
  backgroundStatus,
  isFetching,
  page,
  totalItems,
  totalPages,
  onPageChange,
  onRetryBackground,
}: {
  backgroundStatus: "loading" | "complete" | "error";
  isFetching: boolean;
  page: number;
  totalItems: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onRetryBackground: () => void;
}) {
  const firstItem = (page - 1) * VERIFY_VISITS_PER_PAGE + 1;
  const lastItem = Math.min(page * VERIFY_VISITS_PER_PAGE, totalItems);

  return (
    <div className="flex shrink-0 flex-col gap-2 border-t border-slate-200 bg-white px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="font-bold text-slate-500">
        แสดง VN {firstItem}–{lastItem}
        {backgroundStatus === "complete" ? <> จาก {totalItems} VN</> : null}
        {backgroundStatus === "loading" ? (
          <span className="ml-2 text-blue-600">กำลังโหลดข้อมูลเบื้องหลัง…</span>
        ) : null}
        {backgroundStatus === "complete" ? (
          <span className="ml-2 text-emerald-600">โหลดข้อมูลเบื้องหลังเสร็จแล้ว</span>
        ) : null}
        {backgroundStatus === "error" ? (
          <button className="ml-2 font-black text-rose-600 underline underline-offset-2" onClick={onRetryBackground} type="button">
            โหลดข้อมูลเบื้องหลังไม่สำเร็จ · ลองใหม่
          </button>
        ) : null}
        {isFetching ? <span className="ml-2 text-blue-600">กำลังอัปเดตหน้าแรก...</span> : null}
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
