import { apiPost } from '@/lib/api-client';

export type DrugAllergyPatient = {
  PATIENTID: string;
  FULLNAME_TH: string | null;
};

export type DrugAllergyMedicine = {
  MEDICINECODE: string;
  COMMERCIALNAME: string | null;
  GENERICNAME: string | null;
  LOCALNAME: string | null;
  STRENGTH: string | null;
};

export type DrugAllergyHistoryItem = {
  RECORD_KEY: string;
  CREATEDATETIME: string | null;
  HN: string;
  MEDICINECODE: string;
  COMMERCIALNAME: string | null;
  GENERICNAME: string | null;
  SIDE_EFFECT: string | null;
  ALLERGY_TYPE: string | null;
  SEVERITY: string | null;
  ADVERSE_REACTION_LOCAL: string | null;
  ADVERSE_REACTION_ENGLISH: string | null;
  CORRELATION_LEVEL: string | null;
  CERTIFIED_BY: string | null;
  REMARKS: string | null;
};

export type DrugAllergyHistory = {
  PATIENT: DrugAllergyPatient;
  ITEMS: DrugAllergyHistoryItem[];
};

export function searchDrugAllergyPatients(query: string, signal?: AbortSignal) {
  return apiPost<DrugAllergyPatient[]>('/drug-allergies/search-patients', { query, limit: 20 }, { signal });
}

export function searchDrugAllergyMedicines(query: string, signal?: AbortSignal) {
  return apiPost<DrugAllergyMedicine[]>('/drug-allergies/search-medicines', { query, limit: 20 }, { signal });
}

export function getDrugAllergyHistory(patientId: string, signal?: AbortSignal) {
  return apiPost<DrugAllergyHistory>('/drug-allergies/history', { patientId }, { signal });
}
