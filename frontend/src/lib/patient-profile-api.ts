import type { PatientProfile, PatientQueueItem } from "@/types/pharmacy";

const MOCK_LATENCY_MS = 300;

export async function getPatientProfile(patient: PatientQueueItem): Promise<PatientProfile> {
  await new Promise((resolve) => globalThis.setTimeout(resolve, MOCK_LATENCY_MS));

  const vitalSignLabs: PatientProfile["labs"] = [
    { id: `${patient.id}-lab-bpsys`, key: "BPSYS", value: patient.name === "Patient B" ? "116" : "128", unit: "mmHg" },
    { id: `${patient.id}-lab-bpdias`, key: "BPDIAS", value: patient.name === "Patient B" ? "72" : "78", unit: "mmHg" },
    { id: `${patient.id}-lab-temp`, key: "TEMP", value: "36.7", unit: "°C" },
    { id: `${patient.id}-lab-pulserate`, key: "PULSERATE", value: patient.name === "Patient B" ? "82" : "76", unit: "bpm" },
    { id: `${patient.id}-lab-respira`, key: "RESPIRA", value: "18", unit: "/min" },
    { id: `${patient.id}-lab-o2sat`, key: "O2SAT", value: "98", unit: "%" },
  ];

  // Replace this mock with a patient profile API when the backend is ready.
  // Example: return fetch(`/api/patient-profile?hn=${patient.hn}&vn=${patient.vn}`).then((res) => res.json());
  return {
    patientId: patient.id,
    subjective: `ผู้ป่วยมารับยาตามนัด รู้สึกตัวดี พูดคุยรู้เรื่อง และให้ความร่วมมือในการซักประวัติ ปฏิเสธอาการเจ็บหน้าอก หายใจลำบาก หน้ามืด หรือใจสั่นในช่วงที่ผ่านมา รับประทานอาหารและนอนหลับได้ตามปกติ ไม่มีไข้ ไม่มีคลื่นไส้อาเจียน และไม่มีอาการผิดปกติใหม่ที่ต้องเข้ารับการรักษาเร่งด่วน

ผู้ป่วยแจ้งว่ารับประทานยาประจำได้ค่อนข้างสม่ำเสมอ มีลืมรับประทานยาบางครั้งประมาณ 1 ครั้งต่อสัปดาห์ โดยมักเกิดในช่วงเย็น ไม่ได้เพิ่มขนาดยาเพื่อชดเชยภายหลัง สามารถอธิบายวิธีใช้ยาหลักของตนเองได้ แต่ยังสับสนเรื่องช่วงเวลารับประทานยาบางรายการ จึงต้องการให้เภสัชกรช่วยทบทวนวิธีใช้ยาอีกครั้ง

หลังเริ่มยาชุดปัจจุบันยังไม่พบผื่น คัน บวมบริเวณใบหน้า ปาก หรือลิ้น ไม่เคยมีอาการแน่นหน้าอกหลังรับประทานยา ปฏิเสธการใช้ยาสมุนไพรหรือผลิตภัณฑ์เสริมอาหารเพิ่มเติม ผู้ป่วยระบุว่าไม่ได้ซื้อยาแก้ปวดหรือยาแก้อักเสบมารับประทานเองในช่วง 2 สัปดาห์ที่ผ่านมา

ผู้ป่วยเก็บยาไว้ในกล่องเดิม วางในบริเวณแห้งและพ้นจากแสงแดด มีสมาชิกในครอบครัวช่วยจัดยาเป็นรายสัปดาห์ สามารถเดินทางมารับยาตามนัดได้ และมีเบอร์โทรศัพท์สำหรับติดต่อกรณีต้องติดตามอาการ ผู้ป่วยเข้าใจว่าควรนำยาที่เหลือและรายการยาทั้งหมดมาด้วยในการพบแพทย์ครั้งถัดไป

ตัวอย่างข้อความนี้เป็นข้อมูลจำลองสำหรับแสดงรูปแบบ Subjective เท่านั้น เมื่อเชื่อมต่อ backend ให้แทนค่าจาก API clinical note/subjective โดยตรง และต้องแสดงเป็นข้อมูลอ่านอย่างเดียว ห้ามแก้ไขจากหน้าจอนี้`,
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
            ...vitalSignLabs,
          ]
        : [
            { id: `${patient.id}-lab-egfr`, key: "eGFR", value: patient.alerts.includes("stock") ? "48" : "72", unit: "mL/min", high: patient.alerts.includes("stock") },
            { id: `${patient.id}-lab-scr`, key: "Scr", value: patient.alerts.includes("stock") ? "1.6" : "1.0", unit: "mg/dL", high: patient.alerts.includes("stock") },
            { id: `${patient.id}-lab-ast`, key: "AST", value: "32", unit: "U/L" },
            { id: `${patient.id}-lab-alt`, key: "ALT", value: "28", unit: "U/L" },
            { id: `${patient.id}-lab-k`, key: "K+", value: "4.2", unit: "mmol/L" },
            ...vitalSignLabs,
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
