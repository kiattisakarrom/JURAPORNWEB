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

  // Swap this function body with the real checking checkout API when ready.
  return {
    patientId: patient.id,
    basketLookup: "B-001",
    scanPlaceholder: "ยิงบาร์โค้ดหน้าซองยาเพื่อยืนยัน...",
    summary: {
      prescriptions: 2,
      baskets: 5,
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
        baskets: ["B-003", "B-004", "B-005"],
        items: [
          {
            id: `${patient.id}-check-4`,
            drugName: "Metformin 500 mg",
            dispenseDate: "01/06/2026",
            quantity: "60 เม็ด",
            instruction: "ครั้งละ 1 เม็ด พร้อมอาหาร เช้า-เย็น",
            basketCode: "B-003",
            machineLabel: "Dpro5",
            status: "waiting",
            diStatus: "DI: ปลอดภัย",
            allergyStatus: "Allergy Alert: ผ่าน",
          },
          {
            id: `${patient.id}-check-5`,
            drugName: "Amlodipine 5 mg",
            dispenseDate: "01/06/2026",
            quantity: "30 เม็ด",
            instruction: "วันละ 1 เม็ด หลังอาหารเช้า",
            basketCode: "B-004",
            machineLabel: "LED",
            status: "checked",
            diStatus: "DI: ปลอดภัย",
            allergyStatus: "Allergy Alert: ผ่าน",
          },
          {
            id: `${patient.id}-check-6`,
            drugName: "Atorvastatin 40 mg",
            dispenseDate: "01/06/2026",
            quantity: "30 เม็ด",
            instruction: "วันละ 1 เม็ด ก่อนนอน",
            basketCode: "B-005",
            machineLabel: "Dpro5",
            status: "waiting",
            diStatus: "DI: ปลอดภัย",
            allergyStatus: "Allergy Alert: ผ่าน",
          },
        ],
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

export async function getMatchingCheckout(patient: PatientQueueItem): Promise<MatchingCheckoutResponse> {
  await new Promise((resolve) => globalThis.setTimeout(resolve, 320));

  // Swap this function body with the real matching API when ready.
  return {
    patientId: patient.id,
    prescriptionSearchPlaceholder: "ค้นหาตามชื่อยา / Basket ID / PresNo.",
    medicineSearchPlaceholder: "ค้นหาชื่อยา / รหัสยา",
    basketSearchPlaceholder: "ค้นหา Basket ID / Rx No.",
    prescriptions: [
      {
        id: `${patient.id}-match-pres-1`,
        presNo: "PRE-2026-001",
        createdDate: "15/05/2026 09:30",
        medicines: [
          {
            id: `${patient.id}-match-med-1`,
            medicineCode: "D001",
            medicineName: "Paracetamol 500mg",
            quantity: 10,
            status: "waiting-match",
            baskets: [
              { id: `${patient.id}-basket-1`, basketId: "BSK001", rxNo: "Rx00010", status: "checking" },
              { id: `${patient.id}-basket-2`, basketId: "BSK002", rxNo: "Rx00013", status: "waiting" },
              { id: `${patient.id}-basket-3`, basketId: "BSK003", rxNo: "Rx00012", status: "waiting" },
              { id: `${patient.id}-basket-4`, basketId: "-", rxNo: "Rx00013", status: "verified" },
            ],
          },
          {
            id: `${patient.id}-match-med-2`,
            medicineCode: "D002",
            medicineName: "Amoxicillin 250mg",
            quantity: 20,
            status: "checked",
            baskets: [
              { id: `${patient.id}-basket-5`, basketId: "BSK004", rxNo: "Rx00021", status: "verified" },
              { id: `${patient.id}-basket-6`, basketId: "BSK005", rxNo: "Rx00022", status: "waiting" },
            ],
          },
          {
            id: `${patient.id}-match-med-3`,
            medicineCode: "D003",
            medicineName: "Vitamin C",
            quantity: 30,
            status: "checked",
            baskets: [
              { id: `${patient.id}-basket-7`, basketId: "BSK006", rxNo: "Rx00031", status: "verified" },
              { id: `${patient.id}-basket-8`, basketId: "BSK007", rxNo: "Rx00032", status: "checking" },
            ],
          },
        ],
      },
      {
        id: `${patient.id}-match-pres-2`,
        presNo: "PRE-2026-002",
        createdDate: "18/05/2026 14:20",
        medicines: [
          {
            id: `${patient.id}-match-med-4`,
            medicineCode: "D004",
            medicineName: "Metformin 500mg",
            quantity: 60,
            status: "waiting-match",
            baskets: [
              { id: `${patient.id}-basket-9`, basketId: "BSK011", rxNo: "Rx00110", status: "checking" },
              { id: `${patient.id}-basket-10`, basketId: "BSK012", rxNo: "Rx00111", status: "waiting" },
              { id: `${patient.id}-basket-11`, basketId: "-", rxNo: "Rx00112", status: "verified" },
            ],
          },
          {
            id: `${patient.id}-match-med-5`,
            medicineCode: "D005",
            medicineName: "Losartan 50mg",
            quantity: 30,
            status: "checked",
            baskets: [
              { id: `${patient.id}-basket-12`, basketId: "BSK013", rxNo: "Rx00113", status: "verified" },
              { id: `${patient.id}-basket-13`, basketId: "BSK014", rxNo: "Rx00114", status: "waiting" },
            ],
          },
        ],
      },
      {
        id: `${patient.id}-match-pres-3`,
        presNo: "PRE-2026-003",
        createdDate: "20/05/2026 11:45",
        medicines: [
          {
            id: `${patient.id}-match-med-6`,
            medicineCode: "D006",
            medicineName: "Atorvastatin 40mg",
            quantity: 30,
            status: "waiting-match",
            baskets: [
              { id: `${patient.id}-basket-15`, basketId: "BSK020", rxNo: "Rx00210", status: "checking" },
              { id: `${patient.id}-basket-16`, basketId: "BSK021", rxNo: "Rx00211", status: "waiting" },
            ],
          },
          {
            id: `${patient.id}-match-med-7`,
            medicineCode: "D007",
            medicineName: "Amlodipine 5mg",
            quantity: 30,
            status: "checked",
            baskets: [
              { id: `${patient.id}-basket-17`, basketId: "BSK022", rxNo: "Rx00212", status: "verified" },
              { id: `${patient.id}-basket-18`, basketId: "BSK023", rxNo: "Rx00213", status: "waiting" },
            ],
          },
        ],
      },
    ],
  };
}
