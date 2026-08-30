import { VerifyDoctor, VerifyItem } from './verify-response.interface';

export interface VerifyPrescriptionListFilter {
  PATIENTID: string | null;
  VISITNUMBER: string | null;
  FROMDATE: string | null;
  TODATE: string | null;
}

export interface VerifyPrescriptionPagination {
  PAGE: number;
  LIMIT: number;
  TOTAL_PATIENTS: number;
  TOTAL_VISITS: number;
  TOTAL_PAGES: number;
}

export interface VerifyPrescriptionListItem {
  CREATEDATETIME: string | null;
  VISITDATETIME: string;
  VISITNUMBER: string;
  PRESCRIPTIONNUMBER: string;
  CLINIC_CODE: string | null;
  LOCALWARDNAME: string | null;
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
