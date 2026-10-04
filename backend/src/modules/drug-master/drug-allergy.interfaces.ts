export interface DrugAllergyPatientSearchResult {
  PATIENTID: string;
  FULLNAME_TH: string | null;
}

export interface DrugAllergyMedicineSearchResult {
  MEDICINECODE: string;
  COMMERCIALNAME: string | null;
  GENERICNAME: string | null;
  LOCALNAME: string | null;
  STRENGTH: string | null;
}

export interface DrugAllergyHistoryItem {
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
}

export interface DrugAllergyHistoryResponse {
  PATIENT: DrugAllergyPatientSearchResult;
  ITEMS: DrugAllergyHistoryItem[];
}
