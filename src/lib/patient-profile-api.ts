import type { PatientProfile, PatientQueueItem } from "@/types/pharmacy";

const MOCK_LATENCY_MS = 300;

export async function getPatientProfile(patient: PatientQueueItem): Promise<PatientProfile> {
  await new Promise((resolve) => globalThis.setTimeout(resolve, MOCK_LATENCY_MS));

  // Replace this mock with a patient profile API when the backend is ready.
  // Example: return fetch(`/api/patient-profile?hn=${patient.hn}&vn=${patient.vn}`).then((res) => res.json());
  return {
    patientId: patient.id,
    hn: patient.hn,
    vn: patient.vn,
    fullName: patient.name === "Patient B" ? "Malee Porn" : patient.name,
    age: patient.name === "Patient B" ? "33 ปี" : "48 ปี",
    sex: patient.name === "Patient B" ? "หญิง" : "ไม่ระบุ",
    weight: patient.name === "Patient B" ? "58 kg" : "65 kg",
    height: patient.name === "Patient B" ? "160 cm" : "168 cm",
    ward: patient.name === "Patient B" ? "OPD สูตินรีเวช" : "OPD อายุรกรรม",
    doctor: patient.name === "Patient B" ? "นพ.ศุภชัย พรหมดี" : "พญ.ปาริชาติ ใจดี",
    diagnosis: patient.name === "Patient B" ? "Pregnancy Checkup" : "Follow up medication",
    keyHistory: {
      allergy: patient.issue?.title === "Allergy / ADR" ? "มีประวัติแพ้ยา" : "ไม่มีประวัติแพ้ยา",
      renal: "ไม่มี",
      drugInteraction: patient.alerts.includes("interaction") ? "ไม่พบอันตรกิริยาระหว่างยาที่รุนแรง" : "ไม่พบ",
    },
    labs:
      patient.name === "Patient B"
        ? [
            { id: `${patient.id}-lab-egfr`, key: "eGFR", value: "92", unit: "mL/min" },
            { id: `${patient.id}-lab-hba1c`, key: "HbA1c", value: "8.4", unit: "%", high: true },
            { id: `${patient.id}-lab-hb`, key: "Hb", value: "11.2", unit: "g/dL" },
            { id: `${patient.id}-lab-scr`, key: "Scr", value: "0.8", unit: "mg/dL" },
            { id: `${patient.id}-lab-k`, key: "K+", value: "4.1", unit: "mmol/L" },
          ]
        : [
            { id: `${patient.id}-lab-egfr`, key: "eGFR", value: patient.alerts.includes("stock") ? "48" : "72", unit: "mL/min", high: patient.alerts.includes("stock") },
            { id: `${patient.id}-lab-scr`, key: "Scr", value: patient.alerts.includes("stock") ? "1.6" : "1.0", unit: "mg/dL", high: patient.alerts.includes("stock") },
            { id: `${patient.id}-lab-ast`, key: "AST", value: "32", unit: "U/L" },
            { id: `${patient.id}-lab-alt`, key: "ALT", value: "28", unit: "U/L" },
            { id: `${patient.id}-lab-k`, key: "K+", value: "4.2", unit: "mmol/L" },
          ],
    reconcile: [
      {
        id: `${patient.id}-rec-1`,
        drugName: "Ferrous Fumarate 200 mg",
        quantity: "30 เม็ด",
        instruction: "รับประทานครั้งละ 1 เม็ด วันละ 1 ครั้ง วันเว้นวัน",
        dispenseDate: "01/06/2026",
      },
      {
        id: `${patient.id}-rec-2`,
        drugName: "Folic Acid 5 mg",
        quantity: "30 เม็ด",
        instruction: "รับประทานครั้งละ 1 เม็ด วันละ 1 ครั้ง หลังอาหารเช้า",
        dispenseDate: "01/06/2026",
      },
    ],
    interactions: [
      {
        id: `${patient.id}-di-1`,
        pair: patient.name === "Patient B" ? "Clopidogrel + Omeprazole" : "ไม่พบคู่ยาสำคัญ",
        severity: patient.name === "Patient B" ? "Moderate" : "-",
        recommendation: patient.name === "Patient B" ? "พิจารณายืนยันกับเภสัชกร/แพทย์ก่อนจ่าย" : "ไม่ต้องดำเนินการเพิ่มเติม",
      },
    ],
  };
}
