import { buildQueueResponse } from "@/lib/mock-pharmacy";
import type { CheckingCheckoutResponse, DispensingCheckoutResponse, PatientQueueItem, PharmacyQueueResponse } from "@/types/pharmacy";

const MOCK_LATENCY_MS = 250;

export async function getPharmacyQueue(): Promise<PharmacyQueueResponse> {
  await new Promise((resolve) => globalThis.setTimeout(resolve, MOCK_LATENCY_MS));

  // Swap this function body with a real fetch when the backend is ready.
  // Example: return fetch("/api/pharmacy/queue").then((res) => res.json());
  return buildQueueResponse();
}

export async function getCheckingCheckout(patient: PatientQueueItem): Promise<CheckingCheckoutResponse> {
  await new Promise((resolve) => globalThis.setTimeout(resolve, 320));

  // Swap this function body with the real checking checkout API when ready.
  return {
    patientId: patient.id,
    basketLookup: "B-001",
    scanPlaceholder: "ยิงบาร์โค้ดหน้าซองยาเพื่อยืนยัน...",
    summary: {
      prescriptions: 2,
      baskets: 4,
    },
    prescriptions: [
      {
        id: `${patient.id}-rx-1`,
        rxNo: `RX-${patient.vn.slice(-5)}-01`,
        baskets: ["B-001", "B-002"],
        items: [
          {
            id: `${patient.id}-check-1`,
            drugName: "Ferrous Fumarate 200 mg",
            dispenseDate: "01/06/2026",
            quantity: "30 เม็ด",
            instruction: "วันละ 1 เม็ด หลังอาหารเช้า",
            basketCode: "B-001",
            machineLabel: "LED",
            status: "waiting",
            diStatus: "DI: ปลอดภัย",
            allergyStatus: "Allergy Alert: ผ่าน",
          },
          {
            id: `${patient.id}-check-2`,
            drugName: "Folic Acid 5 mg",
            dispenseDate: "01/06/2026",
            quantity: "30 เม็ด",
            instruction: "วันละ 1 เม็ด หลังอาหารเช้า",
            basketCode: "B-001",
            machineLabel: "Dpro5",
            status: "checked",
            diStatus: "DI: ปลอดภัย",
            allergyStatus: "Allergy Alert: ผ่าน",
          },
          {
            id: `${patient.id}-check-3`,
            drugName: "Calcium Carbonate 1500 mg",
            dispenseDate: "01/06/2026",
            quantity: "60 เม็ด",
            instruction: "วันละ 2 ครั้ง พร้อมอาหาร เช้า-เย็น",
            basketCode: "B-002",
            machineLabel: "HAD",
            status: "locked",
            diStatus: "รอตรวจสอบ",
            allergyStatus: "รอตรวจสอบ",
          },
        ],
      },
      {
        id: `${patient.id}-rx-2`,
        rxNo: `RX-${patient.vn.slice(-5)}-02`,
        baskets: ["B-003", "B-004"],
        items: [],
      },
    ],
  };
}

export async function getDispensingCheckout(patient: PatientQueueItem): Promise<DispensingCheckoutResponse> {
  await new Promise((resolve) => globalThis.setTimeout(resolve, 320));

  // Swap this function body with the real dispensing API when ready.
  const prescriptionItems: DispensingCheckoutResponse["prescriptionItems"] = [
    {
      id: `${patient.id}-dispense-1`,
      drugName: "Amlodipine 5 mg Tablet",
      genericName: "Amlodipine",
      instruction: "วันละ 1 เม็ด เช้าหลังอาหาร",
      quantity: "30 Tab",
      status: "done",
    },
    {
      id: `${patient.id}-dispense-2`,
      drugName: "Metformin 500 mg Tablet",
      genericName: "Metformin Hydrochloride",
      instruction: "ครั้งละ 1 เม็ด พร้อมอาหาร เช้า-เย็น",
      quantity: "60 Tab",
      status: "scanning",
    },
    {
      id: `${patient.id}-dispense-3`,
      drugName: "Paracetamol 500 mg Tablet",
      genericName: "Paracetamol",
      instruction: "ทุก 4-6 ชั่วโมง เวลา ปวด",
      quantity: "20 Tab",
      status: "waiting",
    },
    {
      id: `${patient.id}-dispense-4`,
      drugName: "Losartan 50 mg Tablet",
      genericName: "Losartan Potassium",
      instruction: "วันละ 1 เม็ด หลังอาหารเช้า",
      quantity: "30 Tab",
      status: "waiting",
    },
    {
      id: `${patient.id}-dispense-5`,
      drugName: "Atorvastatin 40 mg Tablet",
      genericName: "Atorvastatin Calcium",
      instruction: "วันละ 1 เม็ด ก่อนนอน",
      quantity: "30 Tab",
      status: "waiting",
    },
    {
      id: `${patient.id}-dispense-6`,
      drugName: "Cetirizine 10 mg Tablet",
      genericName: "Cetirizine Hydrochloride",
      instruction: "วันละ 1 เม็ด ก่อนนอน เมื่อมีอาการ",
      quantity: "10 Tab",
      status: "waiting",
    },
  ];

  return {
    patientId: patient.id,
    basketScanPlaceholder: "สแกนบาร์โค้ดตะกร้า / Basket ID หรือ HN...",
    totalItems: prescriptionItems.length,
    queueStatus: "กำลังดำเนินการ",
    progressText: "2/6 รายการ",
    prescriptionItems,
    activeItem: {
      ...prescriptionItems[1],
      amount: "60",
      unit: "Tab",
      imageSlots: [
        { id: `${patient.id}-front`, label: "ด้านหน้าซองกล่อง" },
        { id: `${patient.id}-side`, label: "ด้านข้างกล่องยา" },
        { id: `${patient.id}-back`, label: "ด้านหลังกล่องยา" },
      ],
      directions: "รับประทานครั้งละ 1 เม็ด พร้อมอาหาร หรือหลังอาหารทันที วันละ 2 ครั้ง (เช้า และ เย็น)",
      precautions: "อาจทำให้เกิดอาการท้องเสีย ท้องอืด หรือคลื่นไส้ในบางรายที่รับประทานยา ควรรับประทานพร้อมอาหารเพื่อลดอาการระคายเคืองกระเพาะ",
    },
  };
}
