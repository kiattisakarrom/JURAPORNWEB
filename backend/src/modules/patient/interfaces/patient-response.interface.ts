export interface PatientVitalSign {
  BODYWEIGHT: number | null;
  HEIGHT: number | null;
  BPSYSTOLIC: number | null;
  BPDIASTOLIC: number | null;
  TEMPERATURE: number | null;
  PULSERATE: number | null;
  RESPIRATIONRATE: number | null;
  O2SAT: number | null;
  CREATEDATETIME: string;
}

export interface PatientResponse {
  PATIENTID: string;
  FULLNAME_TH: string | null;
  VITALSIGNS: PatientVitalSign[];
}
