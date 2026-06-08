import type { PatientQueueItem, PharmacyQueueResponse, QueueStage } from "@/types/pharmacy";

export const mockPatients: PatientQueueItem[] = [
  {
    id: "pt-a",
    vn: "240001",
    hn: "123456",
    name: "Patient A",
    priority: "Stat",
    stage: "verify",
    medicationCount: 2,
    time: "08:05",
    durationMinutes: 10,
    alerts: ["duplicate", "interaction"],
    drugs: [
      { id: "a-1", name: "Atorvastatin 40mg", sig: "1x1 pc · 30 เม็ด", source: "Box Dispenser", machineCode: "D5Pro" },
      { id: "a-2", name: "Amlodipine 5mg", sig: "1x1 pc · 30 เม็ด", source: "Box Dispenser", machineCode: "D5Pro" },
    ],
    issue: {
      kind: "duplicate",
      title: "Duplicate Drug",
      detail: "พบรายการยาซ้ำซ้อน กรุณาตรวจสอบ",
    },
  },
  {
    id: "pt-b",
    vn: "240009",
    hn: "901234",
    name: "Patient B",
    priority: "Stat",
    stage: "verify",
    medicationCount: 2,
    time: "08:05",
    durationMinutes: 15,
    alerts: ["interaction", "machine"],
    drugs: [
      { id: "b-1", name: "Omeprazole 20mg", sig: "1x1 ac · 30 เม็ด", source: "Box Dispenser", machineCode: "D5Pro" },
      { id: "b-2", name: "Simvastatin 20mg", sig: "1x1 hs · 30 เม็ด", source: "Box Dispenser", machineCode: "D5Pro" },
    ],
  },
  {
    id: "pt-l",
    vn: "240002",
    hn: "234567",
    name: "Patient L",
    priority: "Stat",
    stage: "checking",
    medicationCount: 1,
    time: "08:05",
    durationMinutes: 20,
    alerts: [],
    pharmacist: "ภก.วิชัย",
    drugs: [
      { id: "l-1", name: "Warfarin 3mg", sig: "1x1 hs · 30 เม็ด", source: "Manual Pick", machineCode: "Shelf" },
    ],
  },
  {
    id: "pt-c",
    vn: "240006",
    hn: "678901",
    name: "Patient C",
    priority: "Re-work",
    stage: "verify",
    medicationCount: 2,
    time: "08:05",
    durationMinutes: 30,
    alerts: ["duplicate", "stock"],
    drugs: [
      { id: "c-1", name: "Losartan 50mg", sig: "1x1 pc · 30 เม็ด", source: "Box Dispenser", machineCode: "D5Pro" },
      { id: "c-2", name: "Hydrochlorothiazide 25mg", sig: "1x1 pc · 30 เม็ด", source: "Box Dispenser", machineCode: "D5Pro" },
    ],
  },
  {
    id: "pt-d",
    vn: "240003",
    hn: "345678",
    name: "Patient D",
    priority: "New",
    stage: "verify",
    medicationCount: 2,
    time: "08:05",
    durationMinutes: 25,
    alerts: ["note"],
    drugs: [
      { id: "d-1", name: "Metformin 500mg", sig: "1x2 pc · 60 เม็ด", source: "Box Dispenser", machineCode: "D5Pro" },
      { id: "d-2", name: "Metformin 1000mg", sig: "1x1 hs · 30 เม็ด", source: "Box Dispenser", machineCode: "D5Pro" },
    ],
    issue: {
      kind: "note",
      title: "Duplicate Drug",
      detail: "พบรายการยาซ้ำซ้อน กรุณาตรวจสอบ",
    },
  },
  {
    id: "pt-e",
    vn: "240012",
    hn: "333444",
    name: "Patient E",
    priority: "New",
    stage: "verify",
    medicationCount: 2,
    time: "08:05",
    durationMinutes: 35,
    alerts: ["note", "interaction"],
    drugs: [
      { id: "e-1", name: "Glipizide 5mg", sig: "1x1 ac · 30 เม็ด", source: "Box Dispenser", machineCode: "D5Pro" },
      { id: "e-2", name: "Vitamin B Complex", sig: "1x1 pc · 30 เม็ด", source: "Manual Pick", machineCode: "Shelf" },
    ],
  },
  {
    id: "pt-f",
    vn: "240005",
    hn: "567890",
    name: "Patient F",
    priority: "New",
    stage: "pending",
    medicationCount: 1,
    time: "08:05",
    durationMinutes: 40,
    alerts: ["paper"],
    drugs: [
      { id: "f-1", name: "Aspirin 81mg", sig: "1x1 pc · 30 เม็ด", source: "Box Dispenser", machineCode: "D5Pro" },
    ],
  },
  {
    id: "pt-g",
    vn: "240004",
    hn: "456789",
    name: "Patient G",
    priority: "New",
    stage: "complete",
    medicationCount: 1,
    time: "08:05",
    durationMinutes: 45,
    alerts: [],
    drugs: [
      { id: "g-1", name: "Cetirizine 10mg", sig: "1x1 hs · 10 เม็ด", source: "Manual Pick", machineCode: "Shelf" },
    ],
  },
  {
    id: "pt-h",
    vn: "240007",
    hn: "789012",
    name: "Patient H",
    priority: "New",
    stage: "picking",
    medicationCount: 1,
    time: "08:05",
    durationMinutes: 50,
    alerts: [],
    pharmacist: "ภก.วิชัย",
    drugs: [
      { id: "h-1", name: "Paracetamol 500mg", sig: "1x3 pc · 30 เม็ด", source: "Manual Pick", machineCode: "Shelf" },
    ],
  },
  {
    id: "pt-i",
    vn: "240008",
    hn: "890123",
    name: "Patient I",
    priority: "New",
    stage: "matching",
    medicationCount: 1,
    time: "08:05",
    durationMinutes: 55,
    alerts: [],
    pharmacist: "ภก.วิชัย",
    drugs: [
      { id: "i-1", name: "Ibuprofen 400mg", sig: "1x2 pc · 20 เม็ด", source: "Manual Pick", machineCode: "Shelf" },
    ],
  },
  {
    id: "pt-j",
    vn: "240010",
    hn: "112233",
    name: "Patient J",
    priority: "New",
    stage: "dispensing",
    medicationCount: 1,
    time: "08:05",
    durationMinutes: 60,
    alerts: ["paper"],
    drugs: [
      { id: "j-1", name: "Folic Acid 5mg", sig: "1x1 pc · 30 เม็ด", source: "Box Dispenser", machineCode: "D5Pro" },
    ],
  },
  {
    id: "pt-k",
    vn: "240011",
    hn: "445566",
    name: "Patient K",
    priority: "New",
    stage: "missed-call",
    medicationCount: 1,
    time: "08:05",
    durationMinutes: 65,
    alerts: ["machine"],
    drugs: [
      { id: "k-1", name: "Calcium Carbonate 1000mg", sig: "1x1 pc · 30 เม็ด", source: "Box Dispenser", machineCode: "D5Pro" },
    ],
  },
];

const stages: QueueStage[] = ["all", "verify", "picking", "matching", "checking", "dispensing", "pending", "complete", "missed-call"];

export function buildQueueResponse(): PharmacyQueueResponse {
  const summary = stages.reduce(
    (acc, stage) => {
      acc[stage] = stage === "all" ? mockPatients.length : mockPatients.filter((patient) => patient.stage === stage).length;
      return acc;
    },
    {} as PharmacyQueueResponse["summary"],
  );

  summary.verify = 7;
  summary.picking = 1;
  summary.matching = 1;
  summary.checking = 1;
  summary.pending = 1;
  summary.complete = 1;

  return {
    generatedAt: new Date().toISOString(),
    summary,
    patients: mockPatients,
  };
}
