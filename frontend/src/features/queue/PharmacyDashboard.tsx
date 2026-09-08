"use client";

import { useRealtimeQueue } from "@/hooks/useRealtimeQueue";
import { mapVerifyPatientsToQueue } from "@/lib/verify-prescriptions-adapter";
import { AlertTriangle, BarChart3, ChevronLeft, ChevronRight, ClipboardCheck, FileWarning, PackageCheck, Pill, RefreshCw, ScanBarcode } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
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
import { ApiClientError } from "@/lib/api-client";
import {
  VERIFY_VISITS_PER_PAGE,
} from "@/lib/verify-prescriptions-api";
import {
  claimVerifyLock,
  createIdempotencyKey,
  getVerifySessionId,
  heartbeatVerifyLock,
  releaseVerifyLock,
  returnPackageWorkflowToVerify,
  saveVerifyNote,
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
import {
  buildWorkspaceHref,
  parseWorkspaceNavigation,
  popupCloseMode,
  workspaceScreenFromPathname,
  type WorkspacePopupTarget,
} from "@/lib/workspace-navigation";
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
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [fallbackDate] = useState(getBangkokDate);
  const navigation = useMemo(
    () => parseWorkspaceNavigation(searchParams.toString(), fallbackDate),
    [fallbackDate, searchParams],
  );
  const activeScreen = workspaceScreenFromPathname(pathname) ?? "verify";
  const activeTab = navigation.tab;
  const dateRange: WorkspaceDateRange = useMemo(() => ({
    fromDate: navigation.fromDate,
    toDate: navigation.toDate,
  }), [navigation.fromDate, navigation.toDate]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedPrescriptionId, setSelectedPrescriptionId] = useState<string | null>(null);
  const [selectedVerifyAccess, setSelectedVerifyAccess] = useState<{
    workflowId: string | null;
    lockToken: string | null;
    sessionId: string;
    datasetId: string;
    sourceRevision?: string;
    noteDraft?: string | null;
    noteUpdatedAt?: string | null;
    isReadOnly: boolean;
    isLoading: boolean;
    ownerName?: string | null;
  } | null>(null);
  const verifyAccessRequestRef = useRef(0);
  const panelOpenedByAppRef = useRef(false);
  const suppressMissingPopupRef = useRef(false);
  const closingPopupRef = useRef(false);
  const restoredPopupRef = useRef<string | null>(null);
  const invalidPopupRef = useRef<string | null>(null);
  const lastPopupRef = useRef<WorkspacePopupTarget | null>(null);
  const navigationClosePendingRef = useRef(false);
  const selectedStageAtOpenRef = useRef<PatientQueueItem["stage"] | null>(null);
  const [patientPanelCloseRequest, setPatientPanelCloseRequest] = useState(0);
  const [verifyPage, setVerifyPage] = useState(1);
  const liveTime = useLiveClock();
  const realtime = useRealtimeQueue(dateRange);
  const datasetRef = useRef(realtime.datasetId);
  useEffect(() => { datasetRef.current = realtime.datasetId; }, [realtime.datasetId]);
  const syncRealtime = realtime.sync;
  const packageWorkflows = realtime.workflows;
  const packages = realtime.packages;
  const verifyQueue = useMemo(() => mapVerifyPatientsToQueue(realtime.patients,
    new Set(realtime.patients.map(p => p.PATIENTID)).size), [realtime.patients]);
  const verifyBackgroundStatus = realtime.backgroundStatus;
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
  const isCurrentQueueLoading = realtime.loading;
  const showVerifyError = Boolean(realtime.error && !patients.length && !realtime.loading);

  const selectedPatient = selectedId ? patients.find((patient) => patient.id === selectedId) : undefined;
  const selectedPrescription = selectedPatient?.prescriptions?.find((prescription) => prescription.id === selectedPrescriptionId);
  const currentVerifyWorkflow = packageWorkflows.find(w => w.WORKFLOW_ID === selectedVerifyAccess?.workflowId);
  const sameVerifyDataset = selectedVerifyAccess?.datasetId === realtime.datasetId;
  const verifyLeaseValid = Boolean(sameVerifyDataset && currentVerifyWorkflow?.VERIFY_LOCK.IS_LOCKED && currentVerifyWorkflow.VERIFY_LOCK.SESSION_ID === selectedVerifyAccess?.sessionId);
  const verifyLeaseLost = Boolean(selectedVerifyAccess?.lockToken && !selectedVerifyAccess.isLoading && currentVerifyWorkflow && !verifyLeaseValid);
  const verifySourceChanged = Boolean(selectedVerifyAccess?.sourceRevision && selectedPrescription?.sourceRevision !== selectedVerifyAccess.sourceRevision);
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
    if (!sameVerifyDataset || !realtime.connected || !selectedVerifyAccess?.workflowId || !selectedVerifyAccess.lockToken || selectedVerifyAccess.isReadOnly) return;
    const { workflowId, lockToken, sessionId } = selectedVerifyAccess;
    const timer = window.setInterval(() => {
      void heartbeatVerifyLock(workflowId, { lockToken, sessionId })
        .then(() => syncRealtime())
        .catch((error) => {
          if (error instanceof ApiClientError && [403,404,409].includes(error.status)) {
            setSelectedVerifyAccess((current) => current?.workflowId === workflowId && current.lockToken === lockToken
              ? { ...current, lockToken: null, isReadOnly: true } : current);
            toast.error(`เสียสิทธิ์ล็อก Verify: ${readQueryError(error)}`);
          } else {
            // A network failure is not evidence that the server released the lease.
            // Keep unsaved text; the sync connection/expiry gates further actions.
            toast.error("ต่ออายุล็อกไม่สำเร็จ กำลังตรวจการเชื่อมต่อ");
            void syncRealtime();
          }
        });
    }, 30000);

    return () => window.clearInterval(timer);
  }, [syncRealtime, selectedVerifyAccess, sameVerifyDataset, realtime.connected]);

  function workspaceHref(
    screen: WorkspaceScreen = activeScreen,
    tab: QueueStage = activeTab,
    range: WorkspaceDateRange = dateRange,
    popup: WorkspacePopupTarget | null = null,
  ) {
    return buildWorkspaceHref({
      screen,
      tab,
      fromDate: range.fromDate,
      toDate: range.toDate,
      popup,
    });
  }

  function pushPopupUrl(popup: WorkspacePopupTarget) {
    panelOpenedByAppRef.current = true;
    suppressMissingPopupRef.current = true;
    closingPopupRef.current = false;
    router.push(workspaceHref("verify", activeTab, dateRange, popup), { scroll: false });
  }

  function replaceWithoutPopup() {
    panelOpenedByAppRef.current = false;
    suppressMissingPopupRef.current = false;
    closingPopupRef.current = true;
    router.replace(workspaceHref(activeScreen, activeTab, dateRange), { scroll: false });
  }

  function selectTab(tabId: QueueStage) {
    setVerifyPage(1);
    closeSelectedItem();
    panelOpenedByAppRef.current = false;
    closingPopupRef.current = true;
    router.push(workspaceHref("verify", tabId), { scroll: false });
  }

  function selectScreen(screen: WorkspaceScreen) {
    closeSelectedItem();
    panelOpenedByAppRef.current = false;
    closingPopupRef.current = true;
    router.push(workspaceHref(screen, "verify"), { scroll: false });
  }

  function selectQueueItem(id: string, prescriptionId?: string, source: "ui" | "url" = "ui") {
    const candidate = patients.find(patient => patient.id === id);
    if (candidate?.stage === "verify" && !realtime.connected) {
      toast.error("ขาดการเชื่อมต่อ กรุณารอข้อมูลล่าสุดก่อนเปิด Verify"); return;
    }
    if (candidate?.stage === "verify" && candidate.verifyLock?.isLocked && candidate.verifyLock.sessionId !== getVerifySessionId()) {
      toast.error(`VN นี้กำลังใช้งานโดย ${candidate.verifyLock.ownerName ?? "ผู้ใช้อื่น"}`); return;
    }
    const canReuseVerifyAccess = selectedPatient?.id === id && Boolean(selectedVerifyAccess?.lockToken) && verifyLeaseValid;
    const canOpenPopup = candidate?.stage === "verify" || Boolean(candidate && isPackagePopupStage(candidate.stage));
    if (source === "ui" && prescriptionId && canOpenPopup) suppressMissingPopupRef.current = true;
    selectedStageAtOpenRef.current = candidate?.stage ?? null;
    verifyAccessRequestRef.current += 1;
    if (!canReuseVerifyAccess && sameVerifyDataset && selectedVerifyAccess?.workflowId && selectedVerifyAccess.lockToken) {
      void releaseVerifyLock(selectedVerifyAccess.workflowId, {
        lockToken: selectedVerifyAccess.lockToken,
        sessionId: selectedVerifyAccess.sessionId,
      }).catch(() => undefined);
    }
    setSelectedId(id);
    setSelectedPrescriptionId(prescriptionId ?? null);
    const patient = patients.find((candidate) => candidate.id === id);
    if (patient?.stage === "verify" && prescriptionId) {
      if (!canReuseVerifyAccess) {
        void prepareVerifyAccess(patient, prescriptionId, source);
      } else if (source === "ui" && selectedVerifyAccess?.workflowId) {
        const prescription = patient.prescriptions?.find((item) => item.id === prescriptionId);
        if (prescription) pushPopupUrl({ kind: "workflow", id: selectedVerifyAccess.workflowId, pn: prescription.pn });
      }
    } else {
      setSelectedVerifyAccess(null);
      if (source === "ui" && prescriptionId && patient?.packageId && isPackagePopupStage(patient.stage)) {
        const prescription = patient.prescriptions?.find((item) => item.id === prescriptionId);
        if (prescription) pushPopupUrl({ kind: "package", id: patient.packageId, pn: prescription.pn });
      }
    }
  }

  function closeSelectedItem() {
    verifyAccessRequestRef.current += 1;
    const access = selectedVerifyAccess;
    setSelectedId(null);
    setSelectedPrescriptionId(null);
    setSelectedVerifyAccess(null);
    selectedStageAtOpenRef.current = null;
    if (access?.datasetId === realtime.datasetId && access?.workflowId && access.lockToken) {
      void releaseVerifyLock(access.workflowId, { lockToken: access.lockToken, sessionId: access.sessionId })
        .then(() => refreshPackageData())
        .catch(() => undefined);
    }
  }

  function closeSelectedPanel() {
    const hasPopupInUrl = Boolean(navigation.popup);
    closeSelectedItem();
    navigationClosePendingRef.current = false;
    suppressMissingPopupRef.current = false;
    closingPopupRef.current = true;
    restoredPopupRef.current = null;
    if (!hasPopupInUrl) {
      if (lastPopupRef.current) replaceWithoutPopup();
      return;
    }
    if (popupCloseMode(panelOpenedByAppRef.current) === "back") {
      panelOpenedByAppRef.current = false;
      router.back();
      return;
    }
    replaceWithoutPopup();
  }

  function updateDateRange(nextDateRange: WorkspaceDateRange) {
    setVerifyPage(1);
    closeSelectedItem();
    panelOpenedByAppRef.current = false;
    closingPopupRef.current = true;
    router.replace(workspaceHref(activeScreen, activeTab, nextDateRange), { scroll: false });
  }

  function updateSearch(value: string) {
    setSearch(value);
    setVerifyPage(1);
  }

  async function refreshPackageData() {
    await realtime.sync();
  }

  async function prepareVerifyAccess(patient: PatientQueueItem, prescriptionId: string, source: "ui" | "url") {
    const requestId = ++verifyAccessRequestRef.current;
    const sessionId = getVerifySessionId();
    const datasetId = realtime.datasetId;
    const sourceRevision = patient.prescriptions?.find(p => p.id === prescriptionId)?.sourceRevision;
    if (!patient.date) {
      setSelectedVerifyAccess({ workflowId: patient.workflowId ?? null, lockToken: null, sessionId, datasetId, sourceRevision, noteDraft: patient.verifyNoteDraft, noteUpdatedAt: patient.verifyNoteUpdatedAt, isReadOnly: true, isLoading: false });
      if (source === "ui" && patient.workflowId) {
        const prescription = patient.prescriptions?.find((item) => item.id === prescriptionId);
        if (prescription) pushPopupUrl({ kind: "workflow", id: patient.workflowId, pn: prescription.pn });
      } else if (source === "ui") {
        suppressMissingPopupRef.current = false;
      }
      return;
    }
    if (patient.activePackageId) {
      setSelectedVerifyAccess({ workflowId: patient.workflowId ?? null, lockToken: null, sessionId, datasetId, sourceRevision, noteDraft: patient.verifyNoteDraft, noteUpdatedAt: patient.verifyNoteUpdatedAt, isReadOnly: true, isLoading: false, ownerName: "รอรับแพ็กเกจยารอบปัจจุบัน" });
      if (source === "ui" && patient.workflowId) {
        const prescription = patient.prescriptions?.find((item) => item.id === prescriptionId);
        if (prescription) pushPopupUrl({ kind: "workflow", id: patient.workflowId, pn: prescription.pn });
      } else if (source === "ui") {
        suppressMissingPopupRef.current = false;
      }
      return;
    }

    setSelectedVerifyAccess({ workflowId: patient.workflowId ?? null, lockToken: null, sessionId, datasetId, sourceRevision, noteDraft: patient.verifyNoteDraft, noteUpdatedAt: patient.verifyNoteUpdatedAt, isReadOnly: true, isLoading: true });
    try {
      const workflow = await claimVerifyLock({
        visitDate: patient.date.slice(0, 10),
        visitNumber: patient.vn,
        sessionId,
        ownerName: "Pharmacist",
        workstationCode: "VERIFY-WEB",
      });
      // Never send a lease token from Local to a newly selected Live database.
      if (datasetRef.current !== datasetId) return;
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
        datasetId,
        sourceRevision,
        noteDraft: workflow.VERIFY_NOTE_DRAFT,
        noteUpdatedAt: workflow.VERIFY_NOTE_UPDATED_AT,
        isReadOnly: !workflow.VERIFY_LOCK.LOCK_TOKEN,
        isLoading: false,
        ownerName: workflow.VERIFY_LOCK.OWNER_NAME,
      });
      if (source === "ui") {
        const prescription = patient.prescriptions?.find((item) => item.id === prescriptionId);
        if (prescription) pushPopupUrl({ kind: "workflow", id: workflow.WORKFLOW_ID, pn: prescription.pn });
      }
      await refreshPackageData();
    } catch (error) {
      if (verifyAccessRequestRef.current !== requestId) return;
      setSelectedVerifyAccess({
        workflowId: patient.workflowId ?? null,
        lockToken: null,
        sessionId,
        datasetId,
        sourceRevision,
        noteDraft: patient.verifyNoteDraft,
        noteUpdatedAt: patient.verifyNoteUpdatedAt,
        isReadOnly: true,
        isLoading: false,
        ownerName: patient.verifyLock?.ownerName,
      });
      setSelectedId(null);
      setSelectedPrescriptionId(null);
      suppressMissingPopupRef.current = false;
      if (source === "url") replaceWithoutPopup();
      toast.error(`เปิด PatientPanel ไม่สำเร็จ: ${readQueryError(error)}`);
    }
  }

  async function verifySelectedPrescription(input: { mode: "NORMAL" | "URGENT"; selectedDrugIds: string[]; note: string }) {
    if (!realtime.connected) { toast.error("ขาดการเชื่อมต่อ กรุณารอข้อมูลล่าสุดก่อน Verify"); return; }
    if (!verifyLeaseValid || verifySourceChanged) { toast.error("ข้อมูลหรือสิทธิ์ล็อกเปลี่ยนแล้ว กรุณาปิดและเปิด PN เพื่อตรวจใหม่"); return; }
    if (!selectedPrescription || !selectedVerifyAccess?.workflowId || !selectedVerifyAccess.lockToken) return;
    const patient = selectedPatientForPanel;
    if (!patient?.date) return;
    try {
      const selectedDrugIds = new Set(input.selectedDrugIds);
      const selectedItems = selectedPrescription.drugs
        .filter((drug) => selectedDrugIds.has(drug.id) && drug.MEDICINECODE && drug.itemSequence)
        .map((drug) => ({ medicineCode: drug.MEDICINECODE!, itemSeq: drug.itemSequence! }));
      const result = await verifyPackagePrescription(selectedVerifyAccess.workflowId, {
        expectedSourceRevision: selectedPrescription.sourceRevision ?? "",
        lockToken: selectedVerifyAccess.lockToken,
        sessionId: selectedVerifyAccess.sessionId,
        prescriptionNumber: selectedPrescription.pn,
        mode: input.mode,
        packagePriority: input.mode === "URGENT" ? "URGENT" : "NORMAL",
        selectedItems: input.mode === "URGENT" ? selectedItems : undefined,
        note: input.note,
        actorName: "Pharmacist",
        idempotencyKey: createIdempotencyKey(),
      });
      await refreshPackageData();
      if (result.PACKAGE_CREATED) {
        toast.success(`${input.mode === "URGENT" ? "สร้างแพ็กเกจยาด่วน" : "Verify ครบและส่งไป Picking"} แล้ว`);
      } else {
        toast.success(`PN ${selectedPrescription.pn} Verify แล้ว รออีก ${result.WAITING_PRESCRIPTIONS.length} PN`);
      }
      closeSelectedPanel();
    } catch (error) {
      toast.error(readQueryError(error));
      await realtime.sync();
    }
  }

  async function saveSelectedVerifyNote(note: string) {
    const access = selectedVerifyAccess;
    if (!access?.workflowId || !access.lockToken || access.datasetId !== realtime.datasetId) {
      throw new ApiClientError("สิทธิ์ล็อก Verify เปลี่ยนแล้ว", 409);
    }
    if (!realtime.connected || !verifyLeaseValid) {
      throw new ApiClientError("ขาดการเชื่อมต่อหรือสิทธิ์ล็อก Verify หมดอายุ", 409);
    }
    return saveVerifyNote(access.workflowId, {
      lockToken: access.lockToken,
      sessionId: access.sessionId,
      note,
      actorName: "Pharmacist",
    });
  }

  function handleVerifyNoteAccessLost() {
    setSelectedVerifyAccess((current) => current
      ? { ...current, lockToken: null, isReadOnly: true }
      : current);
    void realtime.sync();
  }

  function handlePatientPanelCloseBlocked() {
    navigationClosePendingRef.current = false;
    const popup = lastPopupRef.current;
    if (navigation.popup || !popup) return;
    panelOpenedByAppRef.current = false;
    closingPopupRef.current = false;
    router.replace(workspaceHref("verify", activeTab, dateRange, popup), { scroll: false });
  }

  async function runPrimaryAction(patient: PatientQueueItem) {
    if (!realtime.connected) { toast.error("ขาดการเชื่อมต่อ กรุณารอข้อมูลล่าสุด"); return; }
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
    if (!realtime.connected) { toast.error("ขาดการเชื่อมต่อ กรุณารอข้อมูลล่าสุด"); return; }
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

  const reconcilePopupNavigation = useEffectEvent(() => {
    const popup = navigation.popup;

    if (activeScreen !== "verify") {
      restoredPopupRef.current = null;
      invalidPopupRef.current = null;
      panelOpenedByAppRef.current = false;
      closingPopupRef.current = false;
      navigationClosePendingRef.current = false;
      if (selectedPrescriptionId && !suppressMissingPopupRef.current) closeSelectedItem();
      return;
    }

    if (!popup) {
      restoredPopupRef.current = null;
      invalidPopupRef.current = null;
      closingPopupRef.current = false;
      if (suppressMissingPopupRef.current) return;
      panelOpenedByAppRef.current = false;
      if (selectedPrescriptionId && selectedPatient?.stage === "verify" && selectedVerifyAccess && !selectedVerifyAccess.isLoading) {
        if (!navigationClosePendingRef.current) {
          navigationClosePendingRef.current = true;
          setPatientPanelCloseRequest((current) => current + 1);
        }
      } else if (selectedPrescriptionId) {
        navigationClosePendingRef.current = false;
        closeSelectedItem();
      }
      return;
    }

    if (closingPopupRef.current) return;
    lastPopupRef.current = popup;
    navigationClosePendingRef.current = false;
    suppressMissingPopupRef.current = false;
    const popupKey = `${popup.kind}:${popup.id}:${popup.pn}`;
    const candidate = patients.find((patient) => (
      popup.kind === "workflow"
        ? sameIdentifier(patient.workflowId, popup.id) && patient.stage === "verify"
        : sameIdentifier(patient.packageId, popup.id) && isPackagePopupStage(patient.stage)
    ));
    const prescription = candidate?.prescriptions?.find((item) => item.pn === popup.pn);
    const currentMatches = Boolean(
      selectedPatient
      && selectedPrescription
      && selectedPrescription.pn === popup.pn
      && (popup.kind === "workflow"
        ? sameIdentifier(selectedPatient.workflowId, popup.id)
        : sameIdentifier(selectedPatient.packageId, popup.id)),
    );

    if (currentMatches) {
      if (selectedStageAtOpenRef.current && selectedPatient?.stage !== selectedStageAtOpenRef.current) {
        if (invalidPopupRef.current !== popupKey) {
          invalidPopupRef.current = popupKey;
          toast.info(`VN ${selectedPatient?.vn ?? "นี้"} ถูกส่งไปขั้น ${selectedPatient?.stage ?? "ถัดไป"} แล้ว`);
          closeSelectedItem();
          replaceWithoutPopup();
        }
        return;
      }
      restoredPopupRef.current = popupKey;
      invalidPopupRef.current = null;
      return;
    }

    if (candidate?.stage === "verify" && candidate.verifyLock?.isLocked && candidate.verifyLock.sessionId !== getVerifySessionId()) {
      if (invalidPopupRef.current !== popupKey) {
        invalidPopupRef.current = popupKey;
        toast.error(`VN นี้กำลังใช้งานโดย ${candidate.verifyLock.ownerName ?? "ผู้ใช้อื่น"}`);
        closeSelectedItem();
        replaceWithoutPopup();
      }
      return;
    }

    if (!candidate || !prescription) {
      if (realtime.loading || realtime.backgroundStatus === "loading") return;
      if (invalidPopupRef.current !== popupKey) {
        invalidPopupRef.current = popupKey;
        toast.error("ไม่พบ Workflow, Package หรือ PN ที่ระบุ หรือรายการถูกส่งต่อแล้ว");
        closeSelectedItem();
        replaceWithoutPopup();
      }
      return;
    }

    if (restoredPopupRef.current === popupKey || selectedVerifyAccess?.isLoading) return;
    restoredPopupRef.current = popupKey;
    selectedStageAtOpenRef.current = candidate.stage;
    selectQueueItem(candidate.id, prescription.id, "url");
  });

  useEffect(() => {
    const canonicalHref = buildWorkspaceHref({
      screen: activeScreen,
      tab: activeTab,
      fromDate: dateRange.fromDate,
      toDate: dateRange.toDate,
      popup: activeScreen === "verify" ? navigation.popup : null,
    });
    const query = searchParams.toString();
    const currentHref = `${pathname}${query ? `?${query}` : ""}`;
    if (navigation.needsCleanup || currentHref !== canonicalHref) {
      router.replace(canonicalHref, { scroll: false });
    }
  }, [activeScreen, activeTab, dateRange.fromDate, dateRange.toDate, navigation.needsCleanup, navigation.popup, pathname, router, searchParams]);

  useEffect(() => {
    reconcilePopupNavigation();
  }, [activeScreen, navigation.popup, patients, realtime.backgroundStatus, realtime.loading, selectedPatient, selectedPrescription, selectedPrescriptionId, selectedVerifyAccess?.isLoading]);

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
          onLogout={() => { closeSelectedItem(); onLogout(); }}
          onSearch={updateSearch}
        />

        <div aria-live="polite" className={cn("flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-5 py-1.5 text-xs font-semibold", realtime.connected ? "border-slate-100 bg-white text-slate-500" : "border-amber-200 bg-amber-50 text-amber-800")}>
          <span>{realtime.loading ? "กำลังโหลดข้อมูล..." : realtime.connected ? "เชื่อมต่อแล้ว · อัปเดตเฉพาะรายการที่เปลี่ยน" : "ขาดการเชื่อมต่อ — ข้อมูลอาจไม่ล่าสุด"}{!realtime.loading && realtime.backgroundStatus === "loading" ? ` · กำลังโหลดเบื้องหลัง (${verifyQueue.totalVisits} VN)` : ""}{realtime.backgroundStatus === "error" ? " · โหลดเบื้องหลังไม่สำเร็จ กรุณาลองใหม่" : ""}</span>
          <button className="text-blue-600 underline" onClick={() => void realtime.reload()} type="button">รีเฟรชข้อมูลทั้งหมด</button>
        </div>
        {verifyLeaseLost ? <div role="alert" className="bg-amber-50 px-5 py-2 text-sm text-amber-800">ล็อก Verify ถูกปล่อยหรือหมดอายุแล้ว กรุณาเลือก PN เพื่อขอล็อกใหม่</div> : null}
        {selectedId && !selectedPatient && !realtime.loading ? <div role="status" className="bg-blue-50 px-5 py-2 text-sm text-blue-800">รายการที่เลือกถูกส่งต่อหรือไม่อยู่ในคิวนี้แล้ว</div> : null}

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
                  <VerifyApiErrorState error={realtime.error} onRetry={() => void realtime.reload()} />
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
                        isFetching={realtime.syncing}
                        page={currentPage}
                        totalItems={filteredPatients.length}
                        totalPages={totalPages}
                        onPageChange={setVerifyPage}
                        onRetryBackground={() => void realtime.reload()}
                      />
                    ) : null}
                  </>
                )}
              </section>
            </div>
          ) : null}

          {activeScreen === "matching" || activeScreen === "checking" ? (
            <MatchingCheckingScreen
              packages={packages}
              isLoading={realtime.loading}
              connected={realtime.connected}
              onRefresh={realtime.sync}
              search={search}
              stage={activeScreen}
              onOpenChecking={() => selectScreen("checking")}
            />
          ) : null}
          {activeScreen === "dispensing" ? <DispensingQueueScreen search={search} packages={packages} isLoading={realtime.loading} connected={realtime.connected} onRefresh={realtime.sync} /> : null}
          {activeScreen === "dashboard" ? <OperationsDashboard /> : null}
          {activeScreen === "me" ? <MedicationErrorScreen search={search} /> : null}
        </div>

        {activeScreen === "verify" && selectedPatientForPanel && selectedPrescription && selectedPanel === "checking" ? (
          <CheckingCheckoutPopup patient={selectedPatientForPanel} onClose={closeSelectedPanel} />
        ) : null}
        {activeScreen === "verify" && selectedPatientForPanel && selectedPrescription && selectedPanel === "dispensing" ? (
          <DispensingPopup patient={selectedPatientForPanel} onClose={closeSelectedPanel} />
        ) : null}
        {activeScreen === "verify" && selectedPatientForPanel && selectedPrescription && selectedPanel === "matching" ? (
          <MatchingPopup patient={selectedPatientForPanel} onClose={closeSelectedPanel} />
        ) : null}
        {activeScreen === "verify" && selectedPatientForPanel && selectedPrescription && selectedPanel === "picking" ? (
          <PickingPrescriptionPopup
            patient={selectedPatientForPanel}
            prescriptionNumber={selectedPrescription.pn}
            onClose={closeSelectedPanel}
          />
        ) : null}
        {activeScreen === "verify" && selectedVerifyAccess && !selectedVerifyAccess.isLoading && selectedPatient?.stage === "verify" && selectedPatientForPanel && selectedPanel === "verify" && (!selectedPatient?.prescriptions?.length || selectedPrescription) ? (
          <PatientPanel
            patient={selectedPatientForPanel}
            pn={selectedPrescription?.pn}
            verifyAccess={{...selectedVerifyAccess,
              noteDraft: currentVerifyWorkflow ? currentVerifyWorkflow.VERIFY_NOTE_DRAFT : selectedVerifyAccess.noteDraft ?? null,
              noteUpdatedAt: currentVerifyWorkflow ? currentVerifyWorkflow.VERIFY_NOTE_UPDATED_AT : selectedVerifyAccess.noteUpdatedAt ?? null,
              isConnected: realtime.connected,
              isReadOnly:selectedVerifyAccess.isReadOnly || !selectedVerifyAccess.lockToken || !verifyLeaseValid || !realtime.connected || verifySourceChanged,
              blockedReason: !realtime.connected
                ? "ขาดการเชื่อมต่อ — หยุดทำรายการชั่วคราวจนกว่าจะได้รับข้อมูลล่าสุด"
                : verifySourceChanged
                  ? "ข้อมูลใบยาหรือคำเตือนเปลี่ยนแล้ว กรุณาปิดและเปิด PN เพื่อตรวจข้อมูลล่าสุดก่อน Verify"
                  : !selectedVerifyAccess.lockToken || !verifyLeaseValid
                    ? "สิทธิ์ล็อก Verify ถูกปล่อยหรือหมดอายุแล้ว NOTE ที่ยังไม่บันทึกจะคงอยู่จนกว่าจะปิด Panel"
                    : undefined}}
            onClose={closeSelectedPanel}
            navigationCloseRequest={patientPanelCloseRequest}
            onCloseBlocked={handlePatientPanelCloseBlocked}
            onNoteAccessLost={handleVerifyNoteAccessLost}
            onSaveNote={saveSelectedVerifyNote}
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
        {isFetching ? <span className="ml-2 text-blue-600">กำลังอัปเดตเฉพาะข้อมูลที่เปลี่ยน...</span> : null}
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

function isPackagePopupStage(stage: PatientQueueItem["stage"]) {
  return stage === "picking" || stage === "matching" || stage === "checking" || stage === "dispensing";
}

function sameIdentifier(value: string | undefined, expected: string) {
  return value?.toLowerCase() === expected.toLowerCase();
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
