import { buildQueueResponse } from "@/lib/mock-pharmacy";
import type { CheckingCheckoutResponse, PatientQueueItem, PharmacyQueueResponse } from "@/types/pharmacy";

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
