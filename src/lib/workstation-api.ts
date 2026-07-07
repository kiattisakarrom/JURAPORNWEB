export type WorkflowStage = "matching" | "checking";

export type WorkflowBasketItem = {
  id: string;
  basket: string;
  vn: string;
  hn: string;
  name: string;
  guide: string;
  stage: WorkflowStage;
  items: Array<{
    id: string;
    name: string;
    quantity: string;
    machine: "Box" | "INJ" | "Smart" | "Cold";
    status: "wait" | "doing" | "done";
  }>;
};

export type DispensingQueueItem = {
  id: string;
  vn: string;
  hn: string;
  name: string;
  demo: string;
  channel: string;
  status: "waiting" | "ready" | "called" | "dispensing" | "complete" | "missed-call";
  isStat?: boolean;
  verifyNote: string;
  chips: Array<{ label: string; value: string; high?: boolean }>;
  drugs: Array<{ name: string; sig: string; quantity: string; color: string }>;
};

export type DashboardMetric = {
  label: string;
  value: string;
  unit: string;
  delta: string;
  good?: boolean;
};

export type MedicationErrorReport = {
  code: string;
  date: string;
  time: string;
  vn: string;
  hn: string;
  name: string;
  stage: string;
  isError: boolean;
  severity?: "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I";
  drug: string;
  description: string;
  reporter: string;
};

const MOCK_LATENCY_MS = 220;

export async function getWorkflowBaskets(): Promise<WorkflowBasketItem[]> {
  await new Promise((resolve) => globalThis.setTimeout(resolve, MOCK_LATENCY_MS));

  return [
    {
      id: "basket-2401",
      basket: "B-2401",
      vn: "240001",
      hn: "123456",
      name: "Patient A",
      guide: "NG-0091",
      stage: "matching",
      items: [
        { id: "basket-2401-1", name: "Warfarin 3 mg", quantity: "30 เม็ด", machine: "Box", status: "wait" },
        { id: "basket-2401-2", name: "Aspirin 81 mg", quantity: "30 เม็ด", machine: "Box", status: "wait" },
      ],
    },
    {
      id: "basket-2402",
      basket: "B-2402",
      vn: "240011",
      hn: "345678",
      name: "Patient B",
      guide: "NG-0092",
      stage: "matching",
      items: [
        { id: "basket-2402-1", name: "Enalapril 5 mg", quantity: "30 เม็ด", machine: "Box", status: "wait" },
        { id: "basket-2402-2", name: "Simvastatin 20 mg", quantity: "30 เม็ด", machine: "Box", status: "wait" },
        { id: "basket-2402-3", name: "Insulin glargine", quantity: "1 ปากกา", machine: "Cold", status: "wait" },
      ],
    },
    {
      id: "basket-2398",
      basket: "B-2398",
      vn: "240002",
      hn: "234567",
      name: "Patient L",
      guide: "NG-0088",
      stage: "checking",
      items: [
        { id: "basket-2398-1", name: "Amoxicillin syrup 250/5", quantity: "1 ขวด", machine: "Smart", status: "wait" },
        { id: "basket-2398-2", name: "Paracetamol syrup", quantity: "1 ขวด", machine: "Smart", status: "wait" },
      ],
    },
    {
      id: "basket-2399",
      basket: "B-2399",
      vn: "239998",
      hn: "778899",
      name: "Patient G",
      guide: "NG-0089",
      stage: "checking",
      items: [
        { id: "basket-2399-1", name: "Amlodipine 5 mg", quantity: "30 เม็ด", machine: "Box", status: "wait" },
        { id: "basket-2399-2", name: "Losartan 50 mg", quantity: "30 เม็ด", machine: "Box", status: "wait" },
      ],
    },
  ];
}

export async function getDispensingQueue(): Promise<DispensingQueueItem[]> {
  await new Promise((resolve) => globalThis.setTimeout(resolve, MOCK_LATENCY_MS));

  return [
    {
      id: "queue-240003",
      vn: "240003",
      hn: "567890",
      name: "Patient F",
      demo: "หญิง 29 ปี",
      channel: "7",
      status: "ready",
      verifyNote: "แนะนำรับประทาน Cetirizine ก่อนนอน อาจง่วง หลีกเลี่ยงขับรถ",
      chips: [{ label: "BP", value: "118/76" }, { label: "น้ำหนัก", value: "54 kg" }],
      drugs: [
        { name: "Cetirizine 10 mg", sig: "1 เม็ด ก่อนนอน", quantity: "10 เม็ด", color: "#2f6bf3" },
        { name: "Loratadine 10 mg", sig: "1 เม็ด เช้า", quantity: "10 เม็ด", color: "#7a5cff" },
      ],
    },
    {
      id: "queue-239998",
      vn: "239998",
      hn: "778899",
      name: "Patient G",
      demo: "หญิง 60 ปี",
      channel: "6",
      status: "waiting",
      verifyNote: "ผู้ป่วยมีคำถามเรื่องการปรับยาความดัน",
      chips: [{ label: "BP", value: "142/88", high: true }, { label: "eGFR", value: "66" }],
      drugs: [
        { name: "Amlodipine 5 mg", sig: "1 เม็ด เช้า", quantity: "30 เม็ด", color: "#16a34a" },
        { name: "Losartan 50 mg", sig: "1 เม็ด เช้า", quantity: "30 เม็ด", color: "#e07d12" },
      ],
    },
    {
      id: "queue-240012",
      vn: "240012",
      hn: "112233",
      name: "Patient E",
      demo: "ชาย 51 ปี",
      channel: "6",
      status: "waiting",
      isStat: true,
      verifyNote: "Insulin ต้องแช่เย็น แนะนำการเก็บรักษาและเทคนิคฉีด",
      chips: [{ label: "HbA1c", value: "8.1", high: true }, { label: "FBS", value: "176", high: true }],
      drugs: [
        { name: "Insulin glargine", sig: "10 ยูนิต ก่อนนอน", quantity: "1 ปากกา", color: "#3fa3c9" },
        { name: "Metformin 500 mg", sig: "1 เม็ด วันละ 2 ครั้ง", quantity: "60 เม็ด", color: "#2f6bf3" },
      ],
    },
    {
      id: "queue-240001",
      vn: "240001",
      hn: "123456",
      name: "Patient A",
      demo: "ชาย 58 ปี",
      channel: "7",
      status: "dispensing",
      isStat: true,
      verifyNote: "Warfarin เน้นย้ำติดตาม INR ตามนัด",
      chips: [{ label: "INR", value: "3.8", high: true }, { label: "BP", value: "128/80" }],
      drugs: [
        { name: "Warfarin 3 mg", sig: "1 เม็ด ก่อนนอน", quantity: "30 เม็ด", color: "#a52234" },
        { name: "Aspirin 81 mg", sig: "1 เม็ด หลังอาหารเช้า", quantity: "30 เม็ด", color: "#e0392a" },
      ],
    },
  ];
}

export async function getOperationsDashboard() {
  await new Promise((resolve) => globalThis.setTimeout(resolve, MOCK_LATENCY_MS));

  return {
    metrics: [
      { label: "ใบสั่งยาวันนี้", value: "248", unit: "ใบ", delta: "+12% จากเมื่อวาน", good: true },
      { label: "กำลังดำเนินการ", value: "33", unit: "ใบ", delta: "ค้างในระบบ" },
      { label: "เวลารอเฉลี่ย", value: "14:32", unit: "นาที", delta: "ต่ำกว่าเป้า 15 นาที", good: true },
      { label: "เสร็จสมบูรณ์", value: "215", unit: "ใบ", delta: "86.7% ของวันนี้", good: true },
      { label: "Missed-call", value: "4", unit: "ใบ", delta: "รอติดตาม" },
    ] satisfies DashboardMetric[],
    stages: [
      { label: "New", count: 8, color: "#2f6bf3" },
      { label: "Verify", count: 7, color: "#2f6bf3" },
      { label: "Picking", count: 5, color: "#7a5cff" },
      { label: "Matching", count: 4, color: "#e07d12" },
      { label: "Checking", count: 3, color: "#16a34a" },
      { label: "Dispensing", count: 6, color: "#0a8bb0" },
    ],
    waits: [
      { hour: "08", minute: 12 },
      { hour: "09", minute: 18 },
      { hour: "10", minute: 22 },
      { hour: "11", minute: 16 },
      { hour: "12", minute: 9 },
      { hour: "13", minute: 14 },
    ],
    robots: [
      { tag: "A", name: "Box Dispenser A", load: 18 },
      { tag: "B", name: "Box Dispenser B", load: 9 },
      { tag: "INJ", name: "INJ", load: 12 },
      { tag: "SS", name: "Smart Shelf", load: 6 },
    ],
    alerts: [
      { title: "ยาต่ำกว่า Safety Stock", subtitle: "Amoxicillin syr · Insulin glargine · Losartan", count: 3, tone: "danger" },
      { title: "HAD Checklist รอกรอก", subtitle: "ใบสั่งยา High-Alert ที่ยังไม่ยืนยัน", count: 2, tone: "warning" },
      { title: "Stock diff (Cycle Count)", subtitle: "รอ key expense ที่คลัง HUB 2401", count: 1, tone: "muted" },
    ],
  };
}

export async function getMedicationErrorReports(): Promise<MedicationErrorReport[]> {
  await new Promise((resolve) => globalThis.setTimeout(resolve, MOCK_LATENCY_MS));

  return [
    { code: "ME-2406-014", date: "25 มิ.ย. 69", time: "08:12", vn: "240006", hn: "678901", name: "Patient C", stage: "Verify", isError: true, severity: "B", drug: "Ibuprofen 400 mg", description: "สั่ง NSAIDs ในผู้ป่วยแพ้ Aspirin และ eGFR 38 เภสัชกร intercept ก่อนถึงผู้ป่วย", reporter: "ภญ.พิมพ์ใจ" },
    { code: "ME-2406-013", date: "25 มิ.ย. 69", time: "07:48", vn: "240002", hn: "234567", name: "Patient L", stage: "Checking", isError: true, severity: "C", drug: "Amoxicillin syrup", description: "หยิบความแรงผิด ตรวจพบขั้น Checking แก้ไขก่อนจ่าย", reporter: "จนท.สมหญิง" },
    { code: "ME-2406-012", date: "24 มิ.ย. 69", time: "16:20", vn: "239981", hn: "556677", name: "Patient M", stage: "Dispensing", isError: true, severity: "D", drug: "Warfarin 2 mg", description: "จำนวนเม็ดคลาดเคลื่อนจาก rounding ต้องเฝ้าระวังและนัดตรวจ INR เพิ่ม", reporter: "ภก.ธีรพงษ์" },
    { code: "ME-2406-011", date: "24 มิ.ย. 69", time: "14:05", vn: "239975", hn: "443322", name: "Patient N", stage: "Verify", isError: false, drug: "Metformin 500 mg", description: "แก้ไขวิธีใช้ตามที่แพทย์ยืนยันคำสั่งใหม่ ไม่ถือเป็นความคลาดเคลื่อนทางยา", reporter: "ภญ.พิมพ์ใจ" },
  ];
}
