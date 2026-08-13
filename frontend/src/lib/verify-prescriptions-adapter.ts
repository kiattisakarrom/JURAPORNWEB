import type { PatientPrescription, PatientQueueItem, DrugItem } from "@/types/pharmacy";
import type {
  VerifyPrescriptionApiItem,
  VerifyPrescriptionApiPatient,
  VerifyPrescriptionApiPrescription,
} from "@/lib/verify-prescriptions-api";

export type VerifyQueueData = {
  patients: PatientQueueItem[];
  totalPatients: number;
  totalPrescriptions: number;
  totalVisits: number;
};

export function mapVerifyPatientsToQueue(
  apiPatients: VerifyPrescriptionApiPatient[],
  totalPatients: number,
): VerifyQueueData {
  const patients = apiPatients.flatMap(mapPatientVisits).sort(compareVisitsNewestFirst);

  return {
    patients,
    totalPatients,
    totalPrescriptions: patients.reduce((total, patient) => total + (patient.prescriptions?.length ?? 0), 0),
    totalVisits: patients.length,
  };
}

function mapPatientVisits(patient: VerifyPrescriptionApiPatient): PatientQueueItem[] {
  const visitMap = new Map<string, VerifyPrescriptionApiPrescription[]>();

  patient.PRESCRIPTIONS.forEach((prescription) => {
    const key = `${prescription.VISITDATETIME}|${prescription.VISITNUMBER}`;
    const visitPrescriptions = visitMap.get(key) ?? [];
    visitPrescriptions.push(prescription);
    visitMap.set(key, visitPrescriptions);
  });

  return Array.from(visitMap.values()).map((prescriptions) => {
    const firstPrescription = prescriptions[0];
    const latestCreatedAt = findLatestCreatedAt(prescriptions);
    const mappedPrescriptions = prescriptions.map((prescription) => mapPrescription(patient.PATIENTID, prescription));
    const doctors = prescriptions
      .map((prescription) => prescription.DOCTOR.LOCALDOCTORNAME)
      .filter((doctor): doctor is string => Boolean(doctor));

    return {
      id: createVisitId(patient.PATIENTID, firstPrescription.VISITDATETIME, firstPrescription.VISITNUMBER),
      vn: firstPrescription.VISITNUMBER,
      hn: patient.PATIENTID,
      name: patient.FULLNAME_TH?.trim() || "ไม่พบชื่อผู้ป่วย",
      priority: "Unspecified",
      date: firstPrescription.VISITDATETIME,
      stage: "verify",
      medicationCount: mappedPrescriptions.reduce((total, prescription) => total + prescription.drugs.length, 0),
      time: formatTime(latestCreatedAt),
      durationMinutes: undefined,
      alerts: [],
      drugs: mappedPrescriptions.flatMap((prescription) => prescription.drugs),
      prescriptions: mappedPrescriptions,
      doctor: Array.from(new Set(doctors)).join(", ") || undefined,
      doctorCode: firstPrescription.DOCTOR.DOCTORCODE,
      clinicCode: firstPrescription.CLINIC_CODE,
      wardName: firstPrescription.LOCALWARDNAME,
      prescriptionCreatedAt: latestCreatedAt,
      dataSource: "verify-prescriptions-api",
    };
  });
}

function mapPrescription(patientId: string, prescription: VerifyPrescriptionApiPrescription): PatientPrescription {
  return {
    id: createPrescriptionId(patientId, prescription),
    pn: prescription.PRESCRIPTIONNUMBER,
    date: prescription.VISITDATETIME,
    stage: "verify",
    time: formatTime(prescription.CREATEDATETIME),
    alerts: [],
    drugs: prescription.ITEMS.map((item) => mapDrug(patientId, prescription, item)),
    createdAt: prescription.CREATEDATETIME,
    clinicCode: prescription.CLINIC_CODE,
    wardName: prescription.LOCALWARDNAME,
    doctorCode: prescription.DOCTOR.DOCTORCODE,
    doctor: prescription.DOCTOR.LOCALDOCTORNAME,
  };
}

function mapDrug(
  patientId: string,
  prescription: VerifyPrescriptionApiPrescription,
  item: VerifyPrescriptionApiItem,
): DrugItem {
  const quantity = formatQuantity(item.ORDERQTY, item.ORDERUNITCODE);
  const instruction = item.DOSEMEMO_TH?.trim() || "ไม่มีข้อมูลคำอธิบายวิธีใช้ยา";

  return {
    id: [
      "verify-item",
      patientId,
      prescription.VISITDATETIME,
      prescription.VISITNUMBER,
      prescription.PRESCRIPTIONNUMBER,
      item.ITEMSEQ,
      item.MEDICINECODE,
    ].map(String).map(encodeURIComponent).join(":"),
    name: item.COMMERCIALNAME?.trim() || item.MEDICINECODE,
    sig: `${instruction} · ${quantity}`,
    MEDICINECODE: item.MEDICINECODE,
    DOSEMEMO_TH: item.DOSEMEMO_TH ?? undefined,
    source: "—",
    machineCode: "—",
    itemSequence: item.ITEMSEQ,
    createdAt: item.CREATEDATETIME,
    orderQuantity: item.ORDERQTY,
    orderUnitCode: item.ORDERUNITCODE,
  };
}

function createVisitId(patientId: string, visitDate: string, visitNumber: string) {
  return ["verify-visit", patientId, visitDate, visitNumber].map(encodeURIComponent).join(":");
}

function createPrescriptionId(patientId: string, prescription: VerifyPrescriptionApiPrescription) {
  return [
    "verify-prescription",
    patientId,
    prescription.VISITDATETIME,
    prescription.VISITNUMBER,
    prescription.PRESCRIPTIONNUMBER,
  ].map(encodeURIComponent).join(":");
}

function findLatestCreatedAt(prescriptions: VerifyPrescriptionApiPrescription[]) {
  const timestamps = prescriptions
    .map((prescription) => prescription.CREATEDATETIME)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  return timestamps[0] ?? null;
}

function formatTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Bangkok",
  }).format(date);
}

function formatQuantity(quantity: number | null, unit: string | null) {
  const quantityText = quantity === null ? "—" : new Intl.NumberFormat("th-TH").format(quantity);
  return [quantityText, unit?.trim()].filter(Boolean).join(" ");
}

function compareVisitsNewestFirst(left: PatientQueueItem, right: PatientQueueItem) {
  const dateComparison = (right.prescriptionCreatedAt ?? right.date ?? "").localeCompare(left.prescriptionCreatedAt ?? left.date ?? "");
  if (dateComparison !== 0) return dateComparison;
  return left.vn.localeCompare(right.vn);
}
