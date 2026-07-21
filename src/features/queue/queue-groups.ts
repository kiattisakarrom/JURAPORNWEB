import type { AlertKind, PatientQueueItem, Priority } from "@/types/pharmacy";

export type PatientQueueGroup = {
  hn: string;
  name: string;
  priority: Priority;
  visits: PatientQueueItem[];
  prescriptionCount: number;
  medicationCount: number;
  alerts: AlertKind[];
};

const priorityRank: Record<Priority, number> = {
  Stat: 3,
  "Re-work": 2,
  New: 1,
};

export function groupPatientsByHn(patients: PatientQueueItem[]): PatientQueueGroup[] {
  const groups = new Map<string, PatientQueueItem[]>();

  patients.forEach((patient) => {
    groups.set(patient.hn, [...(groups.get(patient.hn) ?? []), patient]);
  });

  return Array.from(groups.entries()).map(([hn, visits]) => ({
    hn,
    name: visits[0]?.name ?? "ไม่ระบุชื่อ",
    priority: visits.reduce<Priority>(
      (highest, visit) => priorityRank[visit.priority] > priorityRank[highest] ? visit.priority : highest,
      visits[0]?.priority ?? "New",
    ),
    visits,
    prescriptionCount: visits.reduce((total, visit) => total + (visit.prescriptions?.length ?? 0), 0),
    medicationCount: visits.reduce((total, visit) => total + visit.medicationCount, 0),
    alerts: Array.from(new Set(visits.flatMap((visit) => visit.alerts))),
  }));
}
