import type { MedicationPackage, PackageWorkflow } from "@/lib/package-workflow-api";
import type { DrugItem, PatientPrescription, PatientQueueItem, QueueStage } from "@/types/pharmacy";

export function mergeVerifyQueueWithPackageWorkflow(
  sourcePatients: PatientQueueItem[],
  workflows: PackageWorkflow[],
  packages: MedicationPackage[],
) {
  const workflowByVisit = new Map<string, PackageWorkflow>();
  workflows.forEach((workflow) => {
    const key = visitKey(workflow.VISITDATETIME, workflow.VISITNUMBER);
    const current = workflowByVisit.get(key);
    if (!current || (!current.IS_ACTIVE && workflow.IS_ACTIVE)) workflowByVisit.set(key, workflow);
  });
  const packageById = new Map(packages.map((itemPackage) => [itemPackage.PACKAGE_ID, itemPackage]));
  const sourceKeys = new Set(sourcePatients.map((patient) => visitKey(patient.date, patient.vn)));

  const sourceQueue = sourcePatients.flatMap((patient) => {
    const workflow = workflowByVisit.get(visitKey(patient.date, patient.vn));
    if (!workflow) return [patient];
    if (workflow.CASE_STATUS === "COMPLETE" && !workflow.IS_ACTIVE) return [];

    const activePackage = workflow.ACTIVE_PACKAGE_ID ? packageById.get(workflow.ACTIVE_PACKAGE_ID) : undefined;
    const mustRemainAtVerify = !activePackage || activePackage.PACKAGE_PRIORITY === "URGENT";
    if (!mustRemainAtVerify && workflow.CASE_STATUS !== "PENDING") return [];

    return [overlayWorkflow(patient, workflow)];
  });

  const pendingWithoutSource = workflows
    .filter((workflow) => workflow.CASE_STATUS === "PENDING" && !sourceKeys.has(visitKey(workflow.VISITDATETIME, workflow.VISITNUMBER)))
    .map(mapPendingWorkflowToQueue);
  const packageQueue = packages.map(mapPackageToQueue);

  return [...sourceQueue, ...pendingWithoutSource, ...packageQueue];
}

export function workflowVisitKey(value: Pick<PackageWorkflow, "VISITDATETIME" | "VISITNUMBER">) {
  return visitKey(value.VISITDATETIME, value.VISITNUMBER);
}

function overlayWorkflow(patient: PatientQueueItem, workflow: PackageWorkflow): PatientQueueItem {
  const prescriptionByNumber = new Map(workflow.PRESCRIPTIONS.map((prescription) => [prescription.PRESCRIPTIONNUMBER, prescription]));
  const prescriptions = patient.prescriptions?.map((prescription) => {
    const state = prescriptionByNumber.get(prescription.pn);
    return {
      ...prescription,
      verifyStatus: state?.VERIFY_STATUS ?? "WAITING",
      drugs: prescription.drugs.map((drug) => overlayDrug(drug, state?.ITEM_STATES ?? [], workflow.ACTIVE_PACKAGE_ID)),
    };
  });

  return {
    ...patient,
    stage: workflow.CASE_STATUS === "PENDING" ? "pending" : "verify",
    drugs: prescriptions?.flatMap((prescription) => prescription.drugs) ?? patient.drugs,
    prescriptions,
    dataSource: "package-api",
    workflowId: workflow.WORKFLOW_ID,
    workflowCaseStatus: workflow.CASE_STATUS,
    activePackageId: workflow.ACTIVE_PACKAGE_ID,
    verifyLock: {
      sessionId: workflow.VERIFY_LOCK.SESSION_ID,
      ownerName: workflow.VERIFY_LOCK.OWNER_NAME,
      workstationCode: workflow.VERIFY_LOCK.WORKSTATION_CODE,
      expiresAt: workflow.VERIFY_LOCK.EXPIRES_AT,
      isLocked: workflow.VERIFY_LOCK.IS_LOCKED,
    },
  };
}

function overlayDrug(
  drug: DrugItem,
  states: PackageWorkflow["PRESCRIPTIONS"][number]["ITEM_STATES"],
  activePackageId: string | null,
): DrugItem {
  const state = states.find((candidate) => (
    candidate.MEDICINECODE === drug.MEDICINECODE && candidate.ITEMSEQ === drug.itemSequence
  ));
  return {
    ...drug,
    workflowStatus: state ? (state.DISPENSING_PICKUP_STATUS === "RECEIVED" ? "RECEIVED" : state.PAGE_NOW) : undefined,
    packageId: state?.PACKAGE_ID,
    packagePriority: state?.PACKAGE_PRIORITY,
    dispensingPickupStatus: state?.DISPENSING_PICKUP_STATUS,
    isPackageLocked: Boolean(activePackageId),
  };
}

function mapPendingWorkflowToQueue(workflow: PackageWorkflow): PatientQueueItem {
  return {
    id: `package-workflow:${workflow.WORKFLOW_ID}`,
    vn: workflow.VISITNUMBER,
    hn: workflow.PATIENTID ?? "—",
    name: workflow.PATIENT_NAME?.trim() || "ไม่พบชื่อผู้ป่วย",
    priority: "Unspecified",
    date: normalizeDate(workflow.VISITDATETIME),
    stage: "pending",
    medicationCount: 0,
    time: formatTime(workflow.UPDATED_AT),
    alerts: [],
    drugs: [],
    prescriptions: [],
    dataSource: "package-api",
    workflowId: workflow.WORKFLOW_ID,
    workflowCaseStatus: workflow.CASE_STATUS,
    activePackageId: workflow.ACTIVE_PACKAGE_ID,
  };
}

function mapPackageToQueue(itemPackage: MedicationPackage): PatientQueueItem {
  const stage = mapPackagePage(itemPackage.PAGE_NOW);
  const drugsByPrescription = new Map<string, DrugItem[]>();

  itemPackage.ITEMS.forEach((item) => {
    const prescriptionNumber = item.PRESCRIPTIONNUMBER?.trim() || "—";
    const drugs = drugsByPrescription.get(prescriptionNumber) ?? [];
    drugs.push({
      id: item.PACKAGE_ITEM_ID,
      name: item.COMMERCIALNAME?.trim() || item.MEDICINECODE,
      sig: item.DOSEMEMO_TH?.trim() || "ไม่มีข้อมูลคำอธิบายวิธีใช้ยา",
      MEDICINECODE: item.MEDICINECODE,
      DOSEMEMO_TH: item.DOSEMEMO_TH ?? undefined,
      source: "—",
      machineCode: "—",
      itemSequence: item.ITEMSEQ,
      orderQuantity: item.ORDERQTY,
      orderUnitCode: item.ORDERUNITCODE,
      workflowStatus: itemPackage.PAGE_NOW,
      packageId: itemPackage.PACKAGE_ID,
      packagePriority: itemPackage.PACKAGE_PRIORITY,
      dispensingPickupStatus: itemPackage.DISPENSING_PICKUP_STATUS,
      isPackageLocked: itemPackage.IS_ACTIVE,
    });
    drugsByPrescription.set(prescriptionNumber, drugs);
  });

  const prescriptions: PatientPrescription[] = Array.from(drugsByPrescription, ([pn, prescriptionDrugs]) => ({
    id: createPackagePrescriptionId(itemPackage.PACKAGE_ID, pn),
    pn,
    date: normalizeDate(itemPackage.VISITDATETIME),
    stage,
    time: formatTime(itemPackage.UPDATED_AT),
    alerts: [],
    drugs: prescriptionDrugs,
  }));
  const drugs = prescriptions.flatMap((prescription) => prescription.drugs);

  return {
    id: `package:${itemPackage.PACKAGE_ID}`,
    vn: itemPackage.VISITNUMBER,
    hn: itemPackage.PATIENTID ?? "—",
    name: itemPackage.PATIENT_NAME?.trim() || "ไม่พบชื่อผู้ป่วย",
    priority: itemPackage.PACKAGE_PRIORITY === "URGENT" ? "Stat" : "New",
    date: normalizeDate(itemPackage.VISITDATETIME),
    stage,
    medicationCount: drugs.length,
    time: formatTime(itemPackage.UPDATED_AT),
    alerts: [],
    drugs,
    prescriptions,
    dataSource: "package-api",
    workflowId: itemPackage.WORKFLOW_ID,
    workflowCaseStatus: itemPackage.PACKAGE_STATUS,
    activePackageId: itemPackage.IS_ACTIVE ? itemPackage.PACKAGE_ID : null,
    packageId: itemPackage.PACKAGE_ID,
    packagePriority: itemPackage.PACKAGE_PRIORITY,
    workflowAllowedActions: itemPackage.ALLOWED_ACTIONS,
  };
}

function createPackagePrescriptionId(packageId: string, prescriptionNumber: string) {
  return ["package-prescription", packageId, prescriptionNumber].map(encodeURIComponent).join(":");
}

function mapPackagePage(page: MedicationPackage["PAGE_NOW"]): Exclude<QueueStage, "all"> {
  if (page === "AWAITING_DISPENSING") return "dispensing";
  return page.toLowerCase() as Exclude<QueueStage, "all">;
}

function visitKey(date: string | undefined, visitNumber: string) {
  return `${normalizeDate(date)}|${visitNumber}`;
}

function normalizeDate(value?: string) {
  return value?.slice(0, 10) ?? "";
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Bangkok" }).format(date);
}
