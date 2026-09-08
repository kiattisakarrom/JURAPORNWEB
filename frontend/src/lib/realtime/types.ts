import type { MedicationPackage, PackageWorkflow } from "@/lib/package-workflow-api";
import type { VerifyPrescriptionApiPatient } from "@/lib/verify-prescriptions-api";

export type SyncFilter = { fromDate?: string; toDate?: string; patientId?: string; visitNumber?: string };
export type VisitPatch = { VISITDATETIME: string; VISITNUMBER: string; REVISION: string;
  PATIENTS?: VerifyPrescriptionApiPatient[]; WORKFLOWS?: PackageWorkflow[]; PACKAGES?: MedicationPackage[] };
export type LockPatch = { WORKFLOW_ID: string; REVISION: string; VERIFY_LOCK: PackageWorkflow["VERIFY_LOCK"] };
export type SyncResponse = { DATASET_ID: string; CURSOR: string; UPSERTS: VisitPatch[]; LOCKS: LockPatch[];
  REMOVED_KEYS: Array<{ VISITDATETIME:string; VISITNUMBER:string }>; HAS_MORE:boolean;
  SNAPSHOT_ID?:string; NEXT_PAGE_CURSOR?:string|null; TOTAL_VISITS?:number };
export type SyncStatus = { DATASET_ID:string; SOURCE_VERSION:string; WORKFLOW_VERSION:string; HEALTHY:boolean; SERVER_TIME:string };
