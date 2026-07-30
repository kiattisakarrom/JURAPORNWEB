export interface VerifyPatient {
  PATIENTID: string | null;
  FULLNAME_TH: string | null;
}

export interface VerifyDoctor {
  DOCTORCODE: string | null;
  LOCALDOCTORNAME: string | null;
}

export interface VerifyItem {
  ITEMSEQ: number;
  CREATEDATETIME: string | null;
  MEDICINECODE: string;
  COMMERCIALNAME: string | null;
  ORDERQTY: number | null;
  ORDERUNITCODE: string | null;
  DOSEMEMO_TH: string | null;
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
