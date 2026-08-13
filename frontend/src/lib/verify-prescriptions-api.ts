import { apiGet } from "@/lib/api-client";
import { mapVerifyPatientsToQueue, type VerifyQueueData } from "@/lib/verify-prescriptions-adapter";

export const VERIFY_VISITS_PER_PAGE = 50;
const VERIFY_API_BATCH_LIMIT = 100;
const VERIFY_API_CONCURRENCY = 4;

export type VerifyPrescriptionsFilters = {
  patientId?: string;
  visitNumber?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
};

export type VerifyPrescriptionApiItem = {
  ITEMSEQ: number;
  CREATEDATETIME: string | null;
  MEDICINECODE: string;
  COMMERCIALNAME: string | null;
  ORDERQTY: number | null;
  ORDERUNITCODE: string | null;
  DOSEMEMO_TH: string | null;
};

export type VerifyPrescriptionApiDoctor = {
  DOCTORCODE: string | null;
  LOCALDOCTORNAME: string | null;
};

export type VerifyPrescriptionApiPrescription = {
  CREATEDATETIME: string | null;
  VISITDATETIME: string;
  VISITNUMBER: string;
  PRESCRIPTIONNUMBER: string;
  CLINIC_CODE: string | null;
  LOCALWARDNAME: string | null;
  DOCTOR: VerifyPrescriptionApiDoctor;
  ITEMS: VerifyPrescriptionApiItem[];
};

export type VerifyPrescriptionApiPatient = {
  PATIENTID: string;
  FULLNAME_TH: string | null;
  PRESCRIPTIONS: VerifyPrescriptionApiPrescription[];
};

export type VerifyPrescriptionsApiResponse = {
  FILTER: {
    PATIENTID: string | null;
    VISITNUMBER: string | null;
    FROMDATE: string | null;
    TODATE: string | null;
  };
  PAGINATION: {
    PAGE: number;
    LIMIT: number;
    TOTAL_PATIENTS: number;
    TOTAL_PAGES: number;
  };
  PATIENTS: VerifyPrescriptionApiPatient[];
};

export async function getVerifyPrescriptions(
  filters: VerifyPrescriptionsFilters,
  signal?: AbortSignal,
): Promise<VerifyPrescriptionsApiResponse> {
  validateFilters(filters);

  const response = await apiGet<VerifyPrescriptionsApiResponse>("/verify/prescriptions", {
    query: {
      patientId: filters.patientId,
      visitNumber: filters.visitNumber,
      fromDate: filters.fromDate,
      toDate: filters.toDate,
      page: filters.page ?? 1,
      limit: filters.limit ?? 20,
    },
    signal,
  });

  assertVerifyPrescriptionsResponse(response);
  return response;
}

export async function getVerifyPrescriptionQueue(
  filters: Omit<VerifyPrescriptionsFilters, "page" | "limit">,
  signal?: AbortSignal,
): Promise<VerifyQueueData> {
  const firstPage = await getVerifyPrescriptions({
    ...filters,
    page: 1,
    limit: VERIFY_API_BATCH_LIMIT,
  }, signal);
  const pageNumbers = Array.from(
    { length: Math.max(0, firstPage.PAGINATION.TOTAL_PAGES - 1) },
    (_, index) => index + 2,
  );
  const remainingPages: VerifyPrescriptionsApiResponse[] = [];

  for (let index = 0; index < pageNumbers.length; index += VERIFY_API_CONCURRENCY) {
    const chunk = pageNumbers.slice(index, index + VERIFY_API_CONCURRENCY);
    const responses = await Promise.all(chunk.map((page) => getVerifyPrescriptions({
      ...filters,
      page,
      limit: VERIFY_API_BATCH_LIMIT,
    }, signal)));
    remainingPages.push(...responses);
  }

  const patients = mergePatients([firstPage, ...remainingPages]);
  return mapVerifyPatientsToQueue(patients, firstPage.PAGINATION.TOTAL_PATIENTS);
}

function mergePatients(responses: VerifyPrescriptionsApiResponse[]) {
  const patients = new Map<string, VerifyPrescriptionApiPatient>();

  responses.flatMap((response) => response.PATIENTS).forEach((patient) => {
    const existing = patients.get(patient.PATIENTID);
    if (!existing) {
      patients.set(patient.PATIENTID, patient);
      return;
    }

    const prescriptions = new Map(
      existing.PRESCRIPTIONS.map((prescription) => [prescriptionKey(prescription), prescription]),
    );
    patient.PRESCRIPTIONS.forEach((prescription) => prescriptions.set(prescriptionKey(prescription), prescription));
    patients.set(patient.PATIENTID, {
      ...existing,
      FULLNAME_TH: existing.FULLNAME_TH ?? patient.FULLNAME_TH,
      PRESCRIPTIONS: Array.from(prescriptions.values()),
    });
  });

  return Array.from(patients.values());
}

function prescriptionKey(prescription: VerifyPrescriptionApiPrescription) {
  return [prescription.VISITDATETIME, prescription.VISITNUMBER, prescription.PRESCRIPTIONNUMBER].join("|");
}

function validateFilters(filters: VerifyPrescriptionsFilters) {
  const hasDateRange = Boolean(filters.fromDate && filters.toDate);
  if (!filters.patientId && !filters.visitNumber && !hasDateRange) {
    throw new Error("Verify prescriptions API requires patientId, visitNumber, or a complete date range");
  }

  if (Boolean(filters.fromDate) !== Boolean(filters.toDate)) {
    throw new Error("fromDate and toDate must be provided together");
  }
}

function assertVerifyPrescriptionsResponse(value: VerifyPrescriptionsApiResponse): asserts value is VerifyPrescriptionsApiResponse {
  if (!value || typeof value !== "object" || !Array.isArray(value.PATIENTS) || !value.PAGINATION) {
    throw new Error("Verify prescriptions API returned an unsupported response shape");
  }
}
