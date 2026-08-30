import type { AlertKind, ClinicalAlert, PatientPrescription, PatientQueueItem, DrugItem } from "@/types/pharmacy";
import type {
  VerifyClinicalAlertApi,
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
    const drugs = mappedPrescriptions.flatMap((prescription) => prescription.drugs);
    const clinicalAlerts = dedupeClinicalAlerts(drugs.flatMap((drug) => drug.clinicalAlerts ?? []));
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
      alerts: mapAlertKinds(clinicalAlerts),
      clinicalAlerts,
      drugs,
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
  const drugs = prescription.ITEMS.map((item) => mapDrug(patientId, prescription, item));
  const clinicalAlerts = dedupeClinicalAlerts(drugs.flatMap((drug) => drug.clinicalAlerts ?? []));

  return {
    id: createPrescriptionId(patientId, prescription),
    pn: prescription.PRESCRIPTIONNUMBER,
    date: prescription.VISITDATETIME,
    stage: "verify",
    time: formatTime(prescription.CREATEDATETIME),
    alerts: mapAlertKinds(clinicalAlerts),
    clinicalAlerts,
    drugs,
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
    clinicalAlerts: mapClinicalAlerts(item.ALERTS ?? [], item.MEDICINECODE),
  };
}

function mapClinicalAlerts(alerts: VerifyClinicalAlertApi[], medicineCode: string): ClinicalAlert[] {
  return dedupeClinicalAlerts(alerts.map((alert): ClinicalAlert => {
    if (alert.TYPE === "DI") {
      return {
        kind: "interaction",
        medicineCode,
        stockCode: alert.STOCK_CODE,
        stockNameEn: alert.STOCK_NAME_EN,
        withStockCode: alert.WITH_STOCK_CODE,
        withStockCodeNameEn: alert.WITH_STOCK_CODE_NAME_EN,
        severityType: alert.SEVERITY_TYPE,
        severityTypeName: alert.SEVERITY_TYPE_NAME,
        levelTypeName: alert.LEVEL_TYPE_NAME,
        effectsMemo: alert.EFFECTS_MEMO,
        managementMemo: alert.MANAGEMENT_MEMO,
      };
    }

    return {
      kind: "allergy",
      medicineCode,
      sideEffect: alert.SIDE_EFFECT,
      allergyType: alert.ALLERGY_TYPE,
      severity: alert.SEVERITY,
      reaction: alert.REACTION,
      remarks: alert.REMARKS,
    };
  }));
}

function mapAlertKinds(alerts: ClinicalAlert[]): AlertKind[] {
  return Array.from(new Set(alerts.map((alert) => alert.kind)));
}

function dedupeClinicalAlerts(alerts: ClinicalAlert[]): ClinicalAlert[] {
  const uniqueAlerts = new Map<string, ClinicalAlert>();
  alerts.forEach((alert) => {
    const key = alert.kind === "interaction"
      ? JSON.stringify({
          kind: alert.kind,
          pair: [alert.stockCode, alert.withStockCode].sort(),
          severityType: alert.severityType,
          severityTypeName: alert.severityTypeName,
          levelTypeName: alert.levelTypeName,
          effectsMemo: alert.effectsMemo,
          managementMemo: alert.managementMemo,
        })
      : JSON.stringify(alert);
    if (!uniqueAlerts.has(key)) uniqueAlerts.set(key, alert);
  });
  return Array.from(uniqueAlerts.values());
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
