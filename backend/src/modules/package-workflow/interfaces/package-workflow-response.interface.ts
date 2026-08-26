export interface PackageWorkflowItemStateResponse {
  PRESCRIPTIONNUMBER: string;
  MEDICINECODE: string;
  ITEMSEQ: number;
  PACKAGE_ID: string;
  PACKAGE_NUMBER: string;
  PACKAGE_PRIORITY: string;
  PAGE_NOW: string;
  PACKAGE_STATUS: string;
  DISPENSING_PICKUP_STATUS: string | null;
}

export interface PackageWorkflowPrescriptionResponse {
  PACKAGE_PRESCRIPTION_ID: string;
  PRESCRIPTIONNUMBER: string;
  VERIFY_STATUS: string;
  VERIFIED_AT: string | null;
  SOURCE_HASH: string | null;
  ITEM_STATES: PackageWorkflowItemStateResponse[];
}

export interface VerifyLockResponse {
  LOCK_TOKEN: string | null;
  SESSION_ID: string | null;
  OWNER_NAME: string | null;
  WORKSTATION_CODE: string | null;
  LOCKED_AT: string | null;
  EXPIRES_AT: string | null;
  IS_LOCKED: boolean;
}

export interface PackageWorkflowResponse {
  WORKFLOW_ID: string;
  WORKFLOW_PUBLIC_ID: string;
  VISITDATETIME: string;
  VISITNUMBER: string;
  PATIENTID: string | null;
  PATIENT_NAME: string | null;
  WORKFLOW_RUN_NO: number;
  CASE_STATUS: string;
  IS_ACTIVE: boolean;
  QUEUE_NO: number | null;
  BLOCK_REASON_CODE: string | null;
  BLOCK_REASON_TEXT: string | null;
  PAYMENT_STATUS: string;
  CREATED_AT: string;
  UPDATED_AT: string;
  ROW_VERSION: string;
  VERIFY_LOCK: VerifyLockResponse;
  PRESCRIPTIONS: PackageWorkflowPrescriptionResponse[];
  ACTIVE_PACKAGE_ID: string | null;
}

export interface PackageItemResponse {
  PACKAGE_ITEM_ID: string;
  PRESCRIPTIONNUMBER: string;
  ITEMSEQ: number;
  MEDICINECODE: string;
  COMMERCIALNAME: string | null;
  ORDERQTY: number | null;
  ORDERUNITCODE: string | null;
  DOSEMEMO_TH: string | null;
  SOURCE_URGENCY_CODE: string | null;
  PICKING_STATUS: string;
  MATCHING_STATUS: string;
  CHECKING_STATUS: string;
  MATCHED_AT: string | null;
  CHECKED_AT: string | null;
  LABEL: {
    LABEL_PUBLIC_ID: string;
    QR_TOKEN: string;
    LABEL_STATUS: string;
    PRINT_COUNT: number;
    PRINTED_AT: string | null;
  };
}

export interface PackageResponse {
  PACKAGE_ID: string;
  WORKFLOW_ID: string;
  PACKAGE_NUMBER: string;
  BATCH_NO: number;
  PACKAGE_PRIORITY: string;
  PAGE_NOW: string;
  PACKAGE_STATUS: string;
  IS_ACTIVE: boolean;
  VERIFY_NOTE: string | null;
  DISPENSING_PICKUP_STATUS: string | null;
  CALL_COUNT: number;
  LAST_CALLED_AT: string | null;
  RECEIVED_AT: string | null;
  CREATED_AT: string;
  UPDATED_AT: string;
  ROW_VERSION: string;
  VISITDATETIME: string;
  VISITNUMBER: string;
  PATIENTID: string | null;
  PATIENT_NAME: string | null;
  PAYMENT_STATUS: string;
  ALLOWED_ACTIONS: string[];
  ITEMS: PackageItemResponse[];
}

export interface VerifyPackageResponse {
  PACKAGE_CREATED: boolean;
  WAITING_PRESCRIPTIONS: string[];
  WORKFLOW: PackageWorkflowResponse;
  PACKAGE: PackageResponse | null;
}

export interface CheckingPairResponse {
  MATCHED: boolean;
  MESSAGE: string;
  PACKAGE: PackageResponse | null;
}
