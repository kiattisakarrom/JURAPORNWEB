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
  MEDICINECODE: string;
  COMMERCIALNAME: string | null;
  ORDERQTY: number | null;
  ORDERUNITCODE: string | null;
}

export interface VerifyResponse {
  VISITDATETIME: string;
  VISITNUMBER: string;
  PRESCRIPTIONNUMBER: string;
  PATIENT: VerifyPatient;
  DOCTOR: VerifyDoctor;
  ITEMS: VerifyItem[];
}
