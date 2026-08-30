import { buildQueueResponse } from "@/lib/mock-pharmacy";
import type { CheckingCheckoutResponse, DispensingCheckoutResponse, MatchingCheckoutResponse, PatientQueueItem, PharmacyQueueResponse } from "@/types/pharmacy";

const MOCK_LATENCY_MS = 250;

export async function getPharmacyQueue(): Promise<PharmacyQueueResponse> {
  await new Promise((resolve) => globalThis.setTimeout(resolve, MOCK_LATENCY_MS));

  // Swap this function body with a real fetch when the backend is ready.
  // Example: return fetch("/api/pharmacy/queue").then((res) => res.json());
  return buildQueueResponse();
}

export async function getCheckingCheckout(patient: PatientQueueItem): Promise<CheckingCheckoutResponse> {
  await new Promise((resolve) => globalThis.setTimeout(resolve, 320));

  const prescriptions = getQueuePrescriptions(patient).map((prescription, prescriptionIndex) => {
    const basketCode = getBasketCode(patient, prescriptionIndex);

    return {
      id: prescription.id,
      rxNo: prescription.pn,
      baskets: [basketCode],
      items: prescription.drugs.map((drug) => ({
        id: drug.id,
        drugName: drug.name,
        dispenseDate: formatDisplayDate(prescription.date ?? patient.date),
        quantity: formatDrugQuantity(drug.orderQuantity, drug.orderUnitCode),
        instruction: drug.DOSEMEMO_TH?.trim() || drug.sig,
        basketCode,
        machineLabel: drug.machineCode === "—" ? "รอข้อมูล" : drug.machineCode,
        status: "waiting" as const,
        diStatus: drug.clinicalAlerts?.some((alert) => alert.kind === "interaction") ? "DI: พบคำเตือน" : "DI: ไม่พบ",
        allergyStatus: drug.clinicalAlerts?.some((alert) => alert.kind === "allergy") ? "AI: พบคำเตือน" : "AI: ไม่พบ",
      })),
    };
  });
  const baskets = Array.from(new Set(prescriptions.flatMap((prescription) => prescription.baskets)));

  return {
    patientId: patient.id,
    basketLookup: baskets[0] ?? "",
    scanPlaceholder: "ยิงบาร์โค้ดหน้าซองยาเพื่อยืนยัน...",
    summary: {
      prescriptions: prescriptions.length,
      baskets: baskets.length,
    },
    prescriptions,
  };
}

export async function getDispensingCheckout(patient: PatientQueueItem): Promise<DispensingCheckoutResponse> {
  await new Promise((resolve) => globalThis.setTimeout(resolve, 320));

  const selectedPrescription = getQueuePrescriptions(patient)[0];
  const prescriptionItems: DispensingCheckoutResponse["prescriptionItems"] = selectedPrescription.drugs.map((drug, index) => ({
    id: drug.id,
    drugName: drug.name,
    genericName: drug.name,
    instruction: drug.DOSEMEMO_TH?.trim() || drug.sig,
    quantity: formatDrugQuantity(drug.orderQuantity, drug.orderUnitCode),
    status: index === 0 ? "scanning" : "waiting",
  }));
  const activeItem = prescriptionItems[0] ?? {
    id: `${patient.id}-empty-dispensing-item`,
    drugName: "ไม่พบรายการยา",
    genericName: "—",
    instruction: "ไม่มีข้อมูลวิธีใช้ยา",
    quantity: "—",
    status: "waiting" as const,
  };

  return {
    patientId: patient.id,
    prescriptionNumber: selectedPrescription.pn,
    basketScanPlaceholder: "สแกนบาร์โค้ดตะกร้า / Basket ID หรือ HN...",
    totalItems: prescriptionItems.length,
    queueStatus: "กำลังดำเนินการ",
    progressText: `0/${prescriptionItems.length} รายการ`,
    prescriptionItems,
    activeItem: {
      ...activeItem,
      amount: formatQuantityValue(selectedPrescription.drugs[0]?.orderQuantity),
      unit: selectedPrescription.drugs[0]?.orderUnitCode?.trim() || "—",
      imageSlots: [
        { id: `${patient.id}-front`, label: "ด้านหน้าซองกล่อง" },
        { id: `${patient.id}-side`, label: "ด้านข้างกล่องยา" },
        { id: `${patient.id}-back`, label: "ด้านหลังกล่องยา" },
      ],
      directions: selectedPrescription.drugs[0]?.DOSEMEMO_TH?.trim() || selectedPrescription.drugs[0]?.sig || "ไม่มีข้อมูลวิธีใช้ยา",
      precautions: "ตรวจสอบฉลากยา ข้อมูลผู้ป่วย และคำแนะนำก่อนจ่ายยา",
    },
  };
}

export async function getMatchingCheckout(patient: PatientQueueItem): Promise<MatchingCheckoutResponse> {
  await new Promise((resolve) => globalThis.setTimeout(resolve, 320));

  return {
    patientId: patient.id,
    prescriptionSearchPlaceholder: "ค้นหาตามชื่อยา / Basket ID / PresNo.",
    medicineSearchPlaceholder: "ค้นหาชื่อยา / รหัสยา",
    basketSearchPlaceholder: "ค้นหา Basket ID / Rx No.",
    prescriptions: getQueuePrescriptions(patient).map((prescription, prescriptionIndex) => ({
      id: prescription.id,
      presNo: prescription.pn,
      createdDate: formatDisplayDateTime(prescription.createdAt ?? prescription.date ?? patient.date),
      medicines: prescription.drugs.map((drug, drugIndex) => ({
        id: drug.id,
        medicineCode: drug.MEDICINECODE ?? "—",
        medicineName: drug.name,
        quantity: drug.orderQuantity ?? 0,
        status: "waiting-match" as const,
        baskets: [{
          id: `${drug.id}-basket`,
          basketId: getBasketCode(patient, prescriptionIndex),
          rxNo: prescription.pn,
          status: drugIndex === 0 ? "checking" as const : "waiting" as const,
        }],
      })),
    })),
  };
}

function getQueuePrescriptions(patient: PatientQueueItem) {
  if (patient.prescriptions?.length) return patient.prescriptions;

  return [{
    id: `${patient.id}-prescription`,
    pn: "—",
    date: patient.date,
    stage: patient.stage,
    time: patient.time,
    alerts: patient.alerts,
    clinicalAlerts: patient.clinicalAlerts,
    drugs: patient.drugs,
  }];
}

function getBasketCode(patient: PatientQueueItem, index: number) {
  const packageCode = patient.packageId?.slice(0, 12) || patient.vn;
  return `${packageCode}${index > 0 ? `-${index + 1}` : ""}`;
}

function formatDrugQuantity(quantity?: number | null, unit?: string | null) {
  return [formatQuantityValue(quantity), unit?.trim()].filter(Boolean).join(" ");
}

function formatQuantityValue(quantity?: number | null) {
  return quantity === null || quantity === undefined ? "—" : new Intl.NumberFormat("th-TH").format(quantity);
}

function formatDisplayDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "short", timeZone: "Asia/Bangkok" }).format(date);
}

function formatDisplayDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "short",
    timeStyle: "short",
    hour12: false,
    timeZone: "Asia/Bangkok",
  }).format(date);
}
