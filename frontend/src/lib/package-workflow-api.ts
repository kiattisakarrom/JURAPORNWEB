import { apiDelete, apiGet, apiPost } from "@/lib/api-client";
import type { DispensingQueueItem, WorkflowBasketItem, WorkflowStage } from "@/lib/workstation-api";

export type PackagePage = "PICKING" | "MATCHING" | "CHECKING" | "AWAITING_DISPENSING" | "DISPENSING" | "COMPLETE";
export type VerifyMode = "NORMAL" | "URGENT";
export type PackageTransitionAction = "SEND_TO_MATCHING" | "SEND_TO_CHECKING" | "SEND_TO_DISPENSING";
export type DispensingPickupStatus = "WAITING_CALL" | "CALLED_WAITING" | "RECEIVED";

export type PackageWorkflowItemState = {
  PRESCRIPTIONNUMBER: string;
  MEDICINECODE: string;
  ITEMSEQ: number;
  PACKAGE_ID: string;
  PACKAGE_NUMBER: string;
  PACKAGE_PRIORITY: "NORMAL" | "URGENT";
  PAGE_NOW: PackagePage;
  PACKAGE_STATUS: string;
  DISPENSING_PICKUP_STATUS: DispensingPickupStatus | null;
};

export type PackageWorkflowPrescription = {
  PACKAGE_PRESCRIPTION_ID: string;
  PRESCRIPTIONNUMBER: string;
  VERIFY_STATUS: "WAITING" | "VERIFIED_WAITING" | "PARTIAL" | "PACKAGED" | "SOURCE_CHANGED";
  VERIFIED_AT: string | null;
  SOURCE_HASH: string | null;
  ITEM_STATES: PackageWorkflowItemState[];
};

export type PackageWorkflow = {
  WORKFLOW_ID: string;
  WORKFLOW_PUBLIC_ID: string;
  VISITDATETIME: string;
  VISITNUMBER: string;
  PATIENTID: string | null;
  PATIENT_NAME: string | null;
  WORKFLOW_RUN_NO: number;
  CASE_STATUS: string;
  IS_ACTIVE: boolean;
  QUEUE_NO: number | null;
  BLOCK_REASON_CODE: string | null;
  BLOCK_REASON_TEXT: string | null;
  PAYMENT_STATUS: string;
  CREATED_AT: string;
  UPDATED_AT: string;
  ROW_VERSION: string;
  VERIFY_LOCK: {
    LOCK_TOKEN: string | null;
    SESSION_ID: string | null;
    OWNER_NAME: string | null;
    WORKSTATION_CODE: string | null;
    LOCKED_AT: string | null;
    EXPIRES_AT: string | null;
    IS_LOCKED: boolean;
  };
  PRESCRIPTIONS: PackageWorkflowPrescription[];
  ACTIVE_PACKAGE_ID: string | null;
};

export type PackageItem = {
  PACKAGE_ITEM_ID: string;
  PRESCRIPTIONNUMBER: string;
  ITEMSEQ: number;
  MEDICINECODE: string;
  COMMERCIALNAME: string | null;
  ORDERQTY: number | null;
  ORDERUNITCODE: string | null;
  DOSEMEMO_TH: string | null;
  SOURCE_URGENCY_CODE: string | null;
  PICKING_STATUS: string;
  MATCHING_STATUS: string;
  CHECKING_STATUS: string;
  MATCHED_AT: string | null;
  CHECKED_AT: string | null;
  LABEL: {
    LABEL_PUBLIC_ID: string;
    QR_TOKEN: string;
    LABEL_STATUS: string;
    PRINT_COUNT: number;
    PRINTED_AT: string | null;
  };
};

export type MedicationPackage = {
  PACKAGE_ID: string;
  WORKFLOW_ID: string;
  PACKAGE_NUMBER: string;
  BATCH_NO: number;
  PACKAGE_PRIORITY: "NORMAL" | "URGENT";
  PAGE_NOW: PackagePage;
  PACKAGE_STATUS: string;
  IS_ACTIVE: boolean;
  VERIFY_NOTE: string | null;
  DISPENSING_PICKUP_STATUS: DispensingPickupStatus | null;
  CALL_COUNT: number;
  LAST_CALLED_AT: string | null;
  RECEIVED_AT: string | null;
  CREATED_AT: string;
  UPDATED_AT: string;
  ROW_VERSION: string;
  VISITDATETIME: string;
  VISITNUMBER: string;
  PATIENTID: string | null;
  PATIENT_NAME: string | null;
  PAYMENT_STATUS: string;
  ALLOWED_ACTIONS: string[];
  ITEMS: PackageItem[];
};

type DateFilters = { patientId?: string; visitNumber?: string; fromDate?: string; toDate?: string; limit?: number };

export function getPackageWorkflows(filters: DateFilters = {}) {
  return apiGet<PackageWorkflow[]>("/package-workflows", { query: { ...filters, limit: filters.limit ?? 500 } });
}

export function getPackages(filters: DateFilters & { pageNow?: PackagePage } = {}) {
  return apiGet<MedicationPackage[]>("/packages", { query: { ...filters, limit: filters.limit ?? 500 } });
}

export function claimVerifyLock(input: { visitDate: string; visitNumber: string; sessionId: string; ownerName?: string; workstationCode?: string }) {
  return apiPost<PackageWorkflow>("/package-workflows/verify-lock", input);
}

export function heartbeatVerifyLock(workflowId: string, input: { lockToken: string; sessionId: string }) {
  return apiPost<PackageWorkflow>(`/package-workflows/${workflowId}/verify-lock/heartbeat`, input);
}

export function releaseVerifyLock(workflowId: string, input: { lockToken: string; sessionId: string }) {
  return apiDelete<PackageWorkflow>(`/package-workflows/${workflowId}/verify-lock`, input);
}

export function verifyPackagePrescription(workflowId: string, input: {
  lockToken: string;
  sessionId: string;
  prescriptionNumber: string;
  mode: VerifyMode;
  packagePriority?: "NORMAL" | "URGENT";
  selectedItems?: Array<{ medicineCode: string; itemSeq: number }>;
  note?: string;
  actorName?: string;
  idempotencyKey: string;
}) {
  return apiPost<{ PACKAGE_CREATED: boolean; WAITING_PRESCRIPTIONS: string[]; WORKFLOW: PackageWorkflow; PACKAGE: MedicationPackage | null }>(
    `/package-workflows/${workflowId}/verify`, input,
  );
}

export function setPackageWorkflowPending(input: { visitDate: string; visitNumber: string; reasonText?: string; reasonCode?: string; actorName?: string }) {
  return apiPost<PackageWorkflow>("/package-workflows/pending", input);
}

export function returnPackageWorkflowToVerify(workflowId: string, actorName?: string) {
  return apiPost<PackageWorkflow>(`/package-workflows/${workflowId}/return-to-verify`, { actorName });
}

export function transitionPackage(packageId: string, action: PackageTransitionAction) {
  return apiPost<MedicationPackage>(`/packages/${packageId}/transitions`, { action });
}

export function scanPackageMatchingMedicine(packageId: string, medicineCode: string) {
  return apiPost<MedicationPackage>(`/packages/${packageId}/matching/scan`, { medicineCode });
}

export function validatePackageCheckingPair(packageId: string, medicineCode: string, labelQrToken: string) {
  return apiPost<{ MATCHED: boolean; MESSAGE: string; PACKAGE: MedicationPackage | null }>(
    `/packages/${packageId}/checking/validate-pair`, { medicineCode, labelQrToken },
  );
}

export function updatePackageDispensingStatus(packageId: string, status: Exclude<DispensingPickupStatus, "WAITING_CALL">) {
  return apiPost<MedicationPackage>(`/packages/${packageId}/dispensing/status`, { status });
}

export function packageWorkflowKey(workflow: Pick<PackageWorkflow, "VISITDATETIME" | "VISITNUMBER">) {
  return `${normalizeVisitDate(workflow.VISITDATETIME)}|${workflow.VISITNUMBER}`;
}

export function packagePrescriptionUiId(workflow: Pick<PackageWorkflow, "PATIENTID" | "VISITDATETIME" | "VISITNUMBER">, pn: string) {
  return ["verify-prescription", workflow.PATIENTID ?? "", normalizeVisitDate(workflow.VISITDATETIME), workflow.VISITNUMBER, pn]
    .map(encodeURIComponent).join(":");
}

export function mapPackageToBasket(itemPackage: MedicationPackage, stage: WorkflowStage): WorkflowBasketItem {
  return {
    id: itemPackage.PACKAGE_ID,
    basket: itemPackage.PACKAGE_NUMBER,
    vn: itemPackage.VISITNUMBER,
    hn: itemPackage.PATIENTID ?? "—",
    name: itemPackage.PATIENT_NAME?.trim() || "ไม่พบชื่อผู้ป่วย",
    guide: itemPackage.PACKAGE_NUMBER,
    waitingText: itemPackage.PACKAGE_PRIORITY === "URGENT" ? "ยาด่วน" : undefined,
    stage,
    items: itemPackage.ITEMS.map((item) => ({
      id: item.PACKAGE_ITEM_ID,
      code: item.MEDICINECODE,
      stickerCode: item.LABEL.QR_TOKEN,
      name: item.COMMERCIALNAME?.trim() || item.MEDICINECODE,
      quantity: formatQuantity(item.ORDERQTY, item.ORDERUNITCODE),
      machine: "Box" as const,
      status: (stage === "matching" ? item.MATCHING_STATUS : item.CHECKING_STATUS) === "COMPLETED" ? "done" as const : "wait" as const,
      printedAt: item.LABEL.PRINTED_AT ? formatTime(item.LABEL.PRINTED_AT) : undefined,
    })),
  };
}

export function mapPackageToDispensing(itemPackage: MedicationPackage): DispensingQueueItem {
  const pickupStatus = itemPackage.DISPENSING_PICKUP_STATUS ?? "WAITING_CALL";
  return {
    id: itemPackage.PACKAGE_ID,
    vn: itemPackage.VISITNUMBER,
    hn: itemPackage.PATIENTID ?? "—",
    name: itemPackage.PATIENT_NAME?.trim() || "ไม่พบชื่อผู้ป่วย",
    demo: `แพ็กเกจ ${itemPackage.PACKAGE_NUMBER}`,
    channel: "รอจัดช่อง",
    status: pickupStatus === "RECEIVED" ? "complete" : pickupStatus === "CALLED_WAITING" ? "called" : "ready",
    isStat: itemPackage.PACKAGE_PRIORITY === "URGENT",
    verifyNote: itemPackage.VERIFY_NOTE?.trim() || "ผ่าน Verify, Picking, Matching และ Checking แล้ว",
    chips: [{ label: "สถานะรับยา", value: pickupStatusLabel(pickupStatus) }],
    drugs: itemPackage.ITEMS.map((item, index) => ({
      name: item.COMMERCIALNAME?.trim() || item.MEDICINECODE,
      sig: item.DOSEMEMO_TH?.trim() || "ไม่มีข้อมูลวิธีใช้ยา",
      quantity: formatQuantity(item.ORDERQTY, item.ORDERUNITCODE),
      color: ["#2f6bf3", "#7a5cff", "#16a34a", "#e07d12"][index % 4],
    })),
  };
}

export function getVerifySessionId() {
  const storageKey = "pharmauto-verify-session";
  if (typeof window === "undefined") return "server-session";
  const current = window.sessionStorage.getItem(storageKey);
  if (current) return current;
  const next = globalThis.crypto?.randomUUID?.() ?? `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.sessionStorage.setItem(storageKey, next);
  return next;
}

export function createIdempotencyKey() {
  return globalThis.crypto?.randomUUID?.() ?? `request-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeVisitDate(value: string) {
  return value.slice(0, 10);
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Bangkok" }).format(date);
}

function formatQuantity(quantity: number | null, unit: string | null) {
  return [quantity === null ? "—" : new Intl.NumberFormat("th-TH").format(quantity), unit?.trim()].filter(Boolean).join(" ");
}

function pickupStatusLabel(status: DispensingPickupStatus) {
  if (status === "CALLED_WAITING") return "เรียกแล้ว รอรับยา";
  if (status === "RECEIVED") return "รับยาแล้ว";
  return "รอเรียกคิว";
}
