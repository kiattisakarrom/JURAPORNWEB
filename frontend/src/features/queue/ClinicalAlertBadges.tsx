"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import type { AlertKind, ClinicalAlert, DrugInteractionClinicalAlert } from "@/types/pharmacy";
import { alertIcon, alertStyles } from "./queue-ui";

export function ClinicalAlertBadges({
  alerts,
  clinicalAlerts = [],
  emptyLabel = "ไม่มี",
  size = "compact",
}: {
  alerts: AlertKind[];
  clinicalAlerts?: ClinicalAlert[];
  emptyLabel?: string;
  size?: "compact" | "pill";
}) {
  const alertKinds = useMemo(
    () => Array.from(new Set([...alerts, ...clinicalAlerts.map((alert) => alert.kind)])),
    [alerts, clinicalAlerts],
  );
  const interactionAlerts = clinicalAlerts.filter((alert) => alert.kind === "interaction");
  const allergyAlerts = clinicalAlerts.filter((alert) => alert.kind === "allergy");

  if (alertKinds.length === 0) {
    return <span className="text-sm font-bold text-slate-300">{emptyLabel}</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {alertKinds.map((kind) => {
        if (kind === "interaction") {
          return <ClinicalAlertBadge alerts={interactionAlerts} kind={kind} key={kind} size={size} />;
        }
        if (kind === "allergy") {
          return <ClinicalAlertBadge alerts={allergyAlerts} kind={kind} key={kind} size={size} />;
        }

        return (
          <span
            className={cn(
              "flex items-center justify-center",
              size === "pill" ? "min-h-7 rounded-full border px-2.5 py-1" : "h-[30px] w-[30px] rounded-[10px]",
              alertStyles[kind],
            )}
            key={kind}
          >
            {alertIcon(kind)}
          </span>
        );
      })}
    </div>
  );
}

function ClinicalAlertBadge({
  alerts,
  kind,
  size,
}: {
  alerts: ClinicalAlert[];
  kind: "interaction" | "allergy";
  size: "compact" | "pill";
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ left: 8, top: 8 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipId = `clinical-alert-${useId().replaceAll(":", "")}`;
  const label = kind === "interaction" ? "DI" : "AI";

  useEffect(() => {
    if (!isOpen) return;

    function updatePosition() {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const tooltipWidth = Math.min(360, window.innerWidth - 16);
      const estimatedHeight = Math.min(360, Math.max(180, alerts.length * 150));
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - tooltipWidth - 8));
      const belowTop = rect.bottom + 8;
      const top = belowTop + estimatedHeight <= window.innerHeight
        ? belowTop
        : Math.max(8, rect.top - estimatedHeight - 8);
      setPosition({ left, top });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [alerts.length, isOpen]);

  return (
    <>
      <button
        aria-describedby={isOpen && alerts.length > 0 ? tooltipId : undefined}
        aria-expanded={isOpen}
        aria-label={kind === "interaction" ? "รายละเอียดคู่ยาที่มี Drug Interaction" : "รายละเอียดประวัติแพ้ยา"}
        className={cn(
          "flex shrink-0 items-center justify-center font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          size === "pill" ? "min-h-7 rounded-full border px-2.5 py-1 text-xs" : "h-[30px] min-w-[30px] rounded-[10px] border px-1.5 text-[11px]",
          kind === "interaction"
            ? "border-blue-300 bg-blue-50 text-blue-700 focus-visible:ring-blue-500"
            : "border-red-300 bg-red-50 text-red-700 focus-visible:ring-red-500",
        )}
        onBlur={() => setIsOpen(false)}
        onClick={(event) => {
          event.stopPropagation();
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Escape") {
            setIsOpen(false);
            buttonRef.current?.blur();
          }
        }}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onMouseDown={(event) => event.stopPropagation()}
        ref={buttonRef}
        type="button"
      >
        {label}
      </button>

      {isOpen && alerts.length > 0 && typeof document !== "undefined"
        ? createPortal(
            <div
              className="pointer-events-none fixed z-[100] max-h-[360px] w-[min(360px,calc(100vw-16px))] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-2xl"
              id={tooltipId}
              role="tooltip"
              style={{ left: position.left, top: position.top }}
            >
              <div className="mb-3 flex items-center gap-2">
                <span className={cn(
                  "rounded-lg border px-2 py-1 text-xs font-black",
                  kind === "interaction" ? "border-blue-300 bg-blue-50 text-blue-700" : "border-red-300 bg-red-50 text-red-700",
                )}>
                  {label}
                </span>
                <span className="text-sm font-black text-slate-900">
                  {kind === "interaction" ? "Drug Interaction" : "ประวัติแพ้ยา"}
                </span>
              </div>
              <div className="space-y-3">
                {alerts.map((alert, index) => (
                  <ClinicalAlertDetail alert={alert} key={`${clinicalAlertKey(alert)}-${index}`} />
                ))}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function ClinicalAlertDetail({ alert }: { alert: ClinicalAlert }) {
  if (alert.kind === "interaction") {
    const stockName = alert.stockNameEn || alert.stockCode;
    const withName = alert.withStockCodeNameEn || alert.withStockCode;
    const severity = alert.severityTypeName || (alert.severityType === null ? "ไม่ระบุระดับความรุนแรง" : `Severity ${alert.severityType}`);

    return (
      <section className="rounded-xl border border-blue-100 bg-blue-50/40 p-3">
        <div className="text-sm font-black leading-5 text-slate-900">{stockName} ↔ {withName}</div>
        <div className="mt-1 font-mono text-[11px] font-bold text-slate-500">{alert.stockCode} ↔ {alert.withStockCode}</div>
        <div className={cn("mt-2 text-xs font-black", severityTextClass(alert.severityType))}>{severity}</div>
        {alert.levelTypeName ? <DetailRow label="Level" value={alert.levelTypeName} /> : null}
        {alert.effectsMemo ? <DetailRow label="ผลกระทบ" value={alert.effectsMemo} /> : null}
        {alert.managementMemo ? <DetailRow label="การจัดการ" value={alert.managementMemo} /> : null}
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-red-100 bg-red-50/50 p-3">
      <div className="text-sm font-black text-red-800">รหัสยา {alert.medicineCode}</div>
      {alert.sideEffect ? <DetailRow label="อาการแพ้" value={alert.sideEffect} /> : null}
      {alert.reaction ? <DetailRow label="Reaction" value={alert.reaction} /> : null}
      {alert.allergyType ? <DetailRow label="ประเภท" value={alert.allergyType} /> : null}
      {alert.severity ? <DetailRow label="ความรุนแรง" value={alert.severity} /> : null}
      {alert.remarks ? <DetailRow label="หมายเหตุ" value={alert.remarks} /> : null}
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-2 text-xs leading-5 text-slate-600">
      <span className="font-black text-slate-700">{label}:</span> {value}
    </div>
  );
}

export function severityTextClass(severityType: number | null) {
  if (severityType === 1) return "text-red-600";
  if (severityType === 2) return "text-orange-600";
  if (severityType === 3) return "text-emerald-600";
  return "text-slate-500";
}

function clinicalAlertKey(alert: ClinicalAlert) {
  if (alert.kind === "allergy") return JSON.stringify(alert);
  const interaction = alert as DrugInteractionClinicalAlert;
  return JSON.stringify({
    pair: [interaction.stockCode, interaction.withStockCode].sort(),
    severityType: interaction.severityType,
    severityTypeName: interaction.severityTypeName,
    levelTypeName: interaction.levelTypeName,
    effectsMemo: interaction.effectsMemo,
    managementMemo: interaction.managementMemo,
  });
}
