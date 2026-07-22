import { VerifyDoctor, VerifyItem } from './verify-response.interface';

export interface VerifyPrescriptionListFilter {
  PATIENTID: string | null;
  FROMDATE: string | null;
  TODATE: string | null;
}

export interface VerifyPrescriptionPagination {
  PAGE: number;
  LIMIT: number;
  TOTAL_PATIENTS: number;
  TOTAL_PAGES: number;
}

export interface VerifyPrescriptionListItem {
  VISITDATETIME: string;
  VISITNUMBER: string;
  PRESCRIPTIONNUMBER: string;
  DOCTOR: VerifyDoctor;
  ITEMS: VerifyItem[];
}

export interface VerifyPrescriptionPatient {
  PATIENTID: string;
  FULLNAME_TH: string | null;
  PRESCRIPTIONS: VerifyPrescriptionListItem[];
}

export interface VerifyPrescriptionsResponse {
  FILTER: VerifyPrescriptionListFilter;
  PAGINATION: VerifyPrescriptionPagination;
  PATIENTS: VerifyPrescriptionPatient[];
}
