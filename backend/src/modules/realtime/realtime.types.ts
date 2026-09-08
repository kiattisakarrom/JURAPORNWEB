import type { VerifyPrescriptionPatient } from '../verify/interfaces/verify-prescriptions-response.interface';
import type { PackageResponse, PackageWorkflowResponse } from '../package-workflow/interfaces/package-workflow-response.interface';

export type Domain = 'source' | 'workflow';
export interface VisitKey { VISITDATETIME: string; VISITNUMBER: string }
export interface SyncFilter { fromDate?: string; toDate?: string; patientId?: string; visitNumber?: string }
export interface VersionedVisit extends VisitKey {
  REVISION: string;
  PATIENTS?: VerifyPrescriptionPatient[];
  WORKFLOWS?: PackageWorkflowResponse[];
  PACKAGES?: PackageResponse[];
}
export interface LockPatch {
  WORKFLOW_ID: string;
  REVISION: string;
  VERIFY_LOCK: PackageWorkflowResponse['VERIFY_LOCK'];
}
export interface SyncResponse {
  DATASET_ID: string;
  CURSOR: string;
  UPSERTS: VersionedVisit[];
  LOCKS: LockPatch[];
  REMOVED_KEYS: VisitKey[];
  HAS_MORE: boolean;
  SNAPSHOT_ID?: string;
  PAGE_CURSOR?: string;
  NEXT_PAGE_CURSOR?: string | null;
  TOTAL_VISITS?: number;
}
export interface ChangeBatch {
  version: string;
  visits: VisitKey[];
  lockIds: string[];
  reset: boolean;
}
export const visitKey = (visit: VisitKey) => `${visit.VISITDATETIME.slice(0, 10)}|${visit.VISITNUMBER}`;
export const sourceTables = ['TBLORX', 'TBLORXITEMS', 'TBLPATIENT', 'TBLMEDITEMSINFO', 'TBLDOCTOR', 'TBLDEPT', 'TBLREALTIMEINVALIDATIONS'];
export const workflowTables = ['TBLWORKFLOWMASTER', 'TBLPACKAGEPRESCRIPTIONS', 'TBLPACKAGEMASTER', 'TBLPACKAGEITEMS'];
