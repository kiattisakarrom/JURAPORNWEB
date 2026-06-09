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
