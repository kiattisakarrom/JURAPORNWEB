"use client";

import { useTranslation } from "@/i18n";

import { useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PatientQueueItem } from "@/types/pharmacy";
import { ClinicalAlertBadges } from "./ClinicalAlertBadges";
import { durationClass, priorityStyles, stageLabel, stageStyles } from "./queue-ui";
import { VerifyStatusCheckbox } from "./VerifyStatusCheckbox";

function handleKeyboardActivate(event: React.KeyboardEvent, action: () => void) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    action();
  }
}

export function MobileQueueList({
  patients,
  selectedId,
  selectedPrescriptionId,
  verifiedPrescriptionIds,
  onSelect,
  onPendingAction,
  onSendMatching,
}: {
  patients: PatientQueueItem[];
  selectedId?: string;
  selectedPrescriptionId?: string;
  verifiedPrescriptionIds: ReadonlySet<string>;
  onSelect: (id: string, prescriptionId?: string) => void;
  onPendingAction: (patient: PatientQueueItem) => void;
  onSendMatching: (patient: PatientQueueItem) => void;
}) {
  const { t } = useTranslation();
  const [expandedPatientId, setExpandedPatientId] = useState<string | null>(null);

  function toggleExpanded(patientId: string) {
    setExpandedPatientId((current) => current === patientId ? null : patientId);
  }

  return (
    <div className="h-full space-y-3 overflow-y-auto p-4 md:hidden" data-verify-scroll-container>
      {patients.length === 0 ? <div className="py-8 text-center text-sm font-bold text-slate-400">{t("queue.noPatientDataFound")}</div> : null}
      {patients.map((patient) => {
        const prescriptions = patient.prescriptions ?? [];
        const hasPrescriptions = prescriptions.length > 0;
        const canExpand = patient.stage !== "verify" ? hasPrescriptions : prescriptions.length > 1;
        const isExpanded = canExpand && expandedPatientId === patient.id;
        const isSelected = selectedId === patient.id;
        const canSendToMatching = patient.workflowAllowedActions?.includes("SEND_TO_MATCHING") ?? false;
        const activateCard = () => {
          if (!hasPrescriptions) return;
          if (patient.stage === "verify" && prescriptions.length === 1) {
            setExpandedPatientId(null);
            onSelect(patient.id, prescriptions[0].id);
            return;
          }
          toggleExpanded(patient.id);
        };

        return (
          <article className={cn("overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm", (isSelected || isExpanded) && "border-blue-300 bg-blue-50")} key={patient.id}>
            <div
              aria-disabled={!hasPrescriptions}
              aria-expanded={canExpand ? isExpanded : undefined}
              className={cn(
                "w-full p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500",
                hasPrescriptions ? "cursor-pointer" : "cursor-default",
              )}
              onClick={activateCard}
              onKeyDown={(event) => handleKeyboardActivate(event, activateCard)}
              role="button"
              tabIndex={hasPrescriptions ? 0 : -1}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-mono text-sm font-black text-blue-700">{t("common.vn")} {patient.vn}</div>
                  <div className="mt-1 text-base font-black text-slate-800">{patient.name}</div>
                  {patient.verifyLock?.isLocked ? <div className="mt-1 text-xs text-amber-700">{t("queue.verifying")} {patient.verifyLock.ownerName ?? t("common.anotherUser")}</div> : null}
                  {patient.sourceChanged ? <div className="mt-1 text-xs text-amber-700">{t("queue.sourcePrescriptionChangedAfterPackageCreation")}</div> : null}
                  <div className="mt-1 font-mono text-xs font-bold text-slate-400">{t("common.hn")} {patient.hn}</div>
                </div>
                <div className="shrink-0 text-right">
                  <span className={cn("text-sm font-black", priorityStyles[patient.priority])}>{priorityLabel(patient.priority)}</span>
                  <div className="mt-1 text-[11px] font-bold text-slate-400">{t("common.date")} {patient.date ?? "—"}</div>
                  <Badge className={cn("mt-2 w-fit whitespace-nowrap", stageStyles[patient.stage])}>{stageLabel(patient.stage, t)}</Badge>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs font-bold text-slate-400">{t("queue.pnCount")}</div>
                  <div className="mt-1 font-black text-blue-700">{prescriptions.length}  {t("common.pn")}</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-400">{t("queue.medicationCount")}</div>
                  <div className="mt-1 font-black text-slate-600">{patient.medicationCount}  {t("common.items")}</div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <ClinicalAlertBadges
                  alerts={patient.alerts}
                  clinicalAlerts={patient.clinicalAlerts}
                  emptyLabel={t("common.noAlerts")}
                />
                <div className="flex flex-wrap justify-end gap-2" onClick={(event) => event.stopPropagation()}>
                  {patient.stage === "picking" ? (
                    <Button
                      aria-label={t("queue.sendToMatching")}
                      className={cn(
                        "h-9 rounded-xl px-3",
                        "bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:opacity-100",
                      )}
                      disabled={!canSendToMatching}
                      onClick={() => onSendMatching(patient)}
                      title={t("queue.sendToMatching2")}
                      type="button"
                    >
                      {t("queue.sendToMatching")}</Button>
                  ) : null}
                  {patient.stage === "verify" || patient.stage === "pending" ? (
                    <Button
                      className={patient.stage === "pending" ? "border-blue-200 bg-blue-50 text-blue-700" : "border-amber-200 bg-amber-50 text-amber-700"}
                      onClick={() => onPendingAction(patient)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <ArrowLeftRight className="h-3.5 w-3.5" />
                      {patient.stage === "pending" ? t("queue.returnToVerify") : t("queue.sendToPending")}
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>

            {hasPrescriptions && isExpanded ? (
              <div className="space-y-2 border-t border-blue-100 bg-[#f6f9ff] p-3">
                <div className="px-1 pb-1 font-mono text-xs font-black text-blue-800">{t("common.vn")} {patient.vn} — {patient.name}</div>
                {prescriptions.map((prescription) => {
                  const selectRow = () => onSelect(patient.id, prescription.id);

                  return (
                    <div
                      className={cn(
                        "cursor-pointer rounded-xl border border-blue-100 bg-white p-3 transition hover:border-blue-300 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                        selectedPrescriptionId === prescription.id && "border-blue-300 bg-blue-50",
                      )}
                      key={prescription.id}
                      onClick={selectRow}
                      onKeyDown={(event) => handleKeyboardActivate(event, selectRow)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-mono text-sm font-black text-blue-700">{t("common.pn")} {prescription.pn}</div>
                          <div className="mt-1 text-xs font-bold text-slate-400">
                            {t("common.date")}{prescription.date ?? patient.date ?? "—"} · {prescription.time} · {prescription.drugs.length} {t("common.items")}</div>
                        </div>
                        <Badge className={cn("w-fit shrink-0 whitespace-nowrap", stageStyles[prescription.stage])}>{stageLabel(prescription.stage, t)}</Badge>
                      </div>

                      <div className="mt-3 flex items-end justify-between gap-3">
                        <ClinicalAlertBadges
                          alerts={prescription.alerts}
                          clinicalAlerts={prescription.clinicalAlerts}
                          emptyLabel={t("common.noAlerts")}
                        />
                        <div className="text-right text-xs font-bold text-slate-500">
                          <div>{prescription.doctor ?? patient.doctor ?? t("common.awaitingDoctorData")}</div>
                          <div className={cn("mt-1", durationClass(patient.durationMinutes))}>{formatDuration(patient.durationMinutes)} · {priorityLabel(patient.priority)}</div>
                          {prescription.stage === "verify" ? (
                            <span className="mt-2 inline-flex items-center gap-1.5 text-blue-700">
                              {t("queue.check")}<VerifyStatusCheckbox
                                checked={verifiedPrescriptionIds.has(prescription.id)}
                                label={t("queue.verifyStatusForPn", { p0: prescription.pn })}
                              />
                            </span>
                          ) : (
                            <span className="mt-2 block text-slate-400">{stageLabel(prescription.stage, t)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function priorityLabel(priority: PatientQueueItem["priority"]) {
  return priority === "Unspecified" ? "—" : priority;
}

function formatDuration(minutes?: number) {
  return minutes === undefined ? "—" : `${minutes}m`;
}
