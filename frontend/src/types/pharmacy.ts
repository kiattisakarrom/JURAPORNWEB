export type QueueStage =
  | "all"
  | "verify"
  | "picking"
  | "matching"
  | "checking"
  | "dispensing"
  | "pending"
  | "complete"
  | "missed-call";

export type Priority = "Stat" | "Re-work" | "New";

export type AlertKind = "duplicate" | "interaction" | "machine" | "stock" | "paper" | "note";

export type DrugItem = {
  id: string;
  name: string;
  sig: string;
  source: string;
  machineCode: string;
};

export type PatientPrescription = {
  id: string;
  pn: string;
  stage: "verify";
  time: string;
  alerts: AlertKind[];
  drugs: DrugItem[];
  issue?: {
    kind: AlertKind;
    title: string;
    detail: string;
  };
};

export type PatientQueueItem = {
  id: string;
  vn: string;
  hn: string;
  name: string;
  priority: Priority;
  stage: Exclude<QueueStage, "all">;
  medicationCount: number;
  time: string;
  durationMinutes: number;
  alerts: AlertKind[];
  drugs: DrugItem[];
  prescriptions?: PatientPrescription[];
  doctor?: string;
  pharmacist?: string;
  issue?: {
    kind: AlertKind;
    title: string;
    detail: string;
  };
};

export type QueueSummary = Record<QueueStage, number>;

export type PharmacyQueueResponse = {
  generatedAt: string;
  summary: QueueSummary;
  patients: PatientQueueItem[];
};

export type StockCheckItem = {
  id: string;
  drugId: string;
  drugName: string;
  machineName: string;
  machineCode: string;
  available: number;
  required: number;
  capacity: number;
};

export type StockCheckResponse = {
  patientId: string;
  checkedAt: string;
  items: StockCheckItem[];
  canSetPending: boolean;
  shortageMessage?: string;
};

export type PatientLabResult = {
  id: string;
  key: string;
  value: string;
  unit?: string;
  high?: boolean;
};

export type PatientProfile = {
  patientId: string;
  subjective: string;
  hn: string;
  vn: string;
  fullName: string;
  age: string;
  sex: string;
  weight: string;
  height: string;
  ward: string;
  doctor: string;
  diagnosis: string;
  keyHistory: {
    allergy: string;
    renal: string;
    drugInteraction: string;
  };
  labs: PatientLabResult[];
  reconcile: Array<{
    id: string;
    drugName: string;
    quantity: string;
    instruction: string;
    dispenseDate: string;
  }>;
  interactions: Array<{
    id: string;
    pair: string;
    severity: string;
    recommendation: string;
  }>;
};

export type CheckingCheckoutItem = {
  id: string;
  drugName: string;
  dispenseDate: string;
  quantity: string;
  instruction: string;
  basketCode: string;
  machineLabel: string;
  status: "checked" | "waiting" | "locked";
  diStatus: string;
  allergyStatus: string;
};

export type CheckingCheckoutPrescription = {
  id: string;
  rxNo: string;
  baskets: string[];
  items: CheckingCheckoutItem[];
};

export type CheckingCheckoutResponse = {
  patientId: string;
  basketLookup: string;
  scanPlaceholder: string;
  summary: {
    prescriptions: number;
    baskets: number;
  };
  prescriptions: CheckingCheckoutPrescription[];
};

export type DispensingPrescriptionItem = {
  id: string;
  drugName: string;
  genericName: string;
  instruction: string;
  quantity: string;
  status: "done" | "scanning" | "waiting";
};

export type DispensingImageSlot = {
  id: string;
  label: string;
};

export type DispensingCheckoutResponse = {
  patientId: string;
  basketScanPlaceholder: string;
  totalItems: number;
  queueStatus: string;
  progressText: string;
  prescriptionItems: DispensingPrescriptionItem[];
  activeItem: DispensingPrescriptionItem & {
    amount: string;
    unit: string;
    imageSlots: DispensingImageSlot[];
    directions: string;
    precautions: string;
  };
};

export type MatchingBasketItem = {
  id: string;
  basketId: string;
  rxNo: string;
  status: "checking" | "waiting" | "verified";
};

export type MatchingMedicineItem = {
  id: string;
  medicineCode: string;
  medicineName: string;
  quantity: number;
  status: "waiting-match" | "checked";
  baskets: MatchingBasketItem[];
};

export type MatchingPrescriptionItem = {
  id: string;
  presNo: string;
  createdDate: string;
  medicines: MatchingMedicineItem[];
};

export type MatchingCheckoutResponse = {
  patientId: string;
  prescriptionSearchPlaceholder: string;
  medicineSearchPlaceholder: string;
  basketSearchPlaceholder: string;
  prescriptions: MatchingPrescriptionItem[];
};
