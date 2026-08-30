export interface VerifyPatient {
  PATIENTID: string | null;
  FULLNAME_TH: string | null;
}

export interface VerifyDoctor {
  DOCTORCODE: string | null;
  LOCALDOCTORNAME: string | null;
}

export interface VerifyDrugInteractionAlert {
  TYPE: 'DI';
  STOCK_CODE: string;
  STOCK_NAME_EN: string | null;
  WITH_STOCK_CODE: string;
  WITH_STOCK_CODE_NAME_EN: string | null;
  SEVERITY_TYPE: number | null;
  SEVERITY_TYPE_NAME: string | null;
  LEVEL_TYPE_NAME: string | null;
  EFFECTS_MEMO: string | null;
  MANAGEMENT_MEMO: string | null;
}

export interface VerifyAllergyAlert {
  TYPE: 'AI';
  SIDE_EFFECT: string | null;
  ALLERGY_TYPE: string | null;
  SEVERITY: string | null;
  REACTION: string | null;
  REMARKS: string | null;
}

export type VerifyClinicalAlert =
  | VerifyDrugInteractionAlert
  | VerifyAllergyAlert;

export interface VerifyItem {
  ITEMSEQ: number;
  CREATEDATETIME: string | null;
  MEDICINECODE: string;
  COMMERCIALNAME: string | null;
  ORDERQTY: number | null;
  ORDERUNITCODE: string | null;
  DOSEMEMO_TH: string | null;
  ALERTS: VerifyClinicalAlert[];
}

export interface VerifyResponse {
  CREATEDATETIME: string | null;
  VISITDATETIME: string;
  VISITNUMBER: string;
  PRESCRIPTIONNUMBER: string;
  CLINIC_CODE: string | null;
  LOCALWARDNAME: string | null;
  PATIENT: VerifyPatient;
  DOCTOR: VerifyDoctor;
  ITEMS: VerifyItem[];
}
