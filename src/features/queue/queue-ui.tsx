import { AlertTriangle, CheckCircle2, PackageCheck, Pill, Siren, Sparkles } from "lucide-react";
import type { AlertKind, PatientQueueItem, Priority } from "@/types/pharmacy";

export const alertStyles: Record<AlertKind, string> = {
  duplicate: "bg-rose-100 text-rose-600",
  interaction: "bg-blue-100 text-blue-700",
  machine: "bg-orange-100 text-orange-600",
  stock: "bg-pink-100 text-pink-700",
  paper: "bg-yellow-100 text-amber-700",
  note: "bg-violet-100 text-violet-700",
};

export const priorityStyles: Record<Priority, string> = {
  Stat: "text-red-500",
  "Re-work": "text-orange-500",
  New: "text-slate-400",
};

export const stageStyles: Record<PatientQueueItem["stage"], string> = {
  verify: "bg-blue-100 text-blue-700",
  picking: "bg-cyan-100 text-cyan-700",
  matching: "bg-violet-100 text-violet-700",
  checking: "bg-emerald-100 text-emerald-700",
  dispensing: "bg-indigo-100 text-indigo-700",
  pending: "bg-yellow-100 text-amber-700",
  complete: "bg-slate-100 text-slate-600",
  "missed-call": "bg-rose-100 text-rose-700",
};

export const stageDotStyles: Record<PatientQueueItem["stage"], string> = {
  verify: "bg-blue-500",
  picking: "bg-cyan-500",
  matching: "bg-violet-500",
  checking: "bg-emerald-500",
  dispensing: "bg-indigo-500",
  pending: "bg-amber-500",
  complete: "bg-slate-400",
  "missed-call": "bg-rose-500",
};

export function stageLabel(stage: PatientQueueItem["stage"]) {
  if (stage === "missed-call") return "Missed-call";
  return stage.charAt(0).toUpperCase() + stage.slice(1);
}

export function durationClass(minutes: number) {
  if (minutes <= 20) return "text-emerald-500";
  if (minutes <= 30) return "text-orange-500";
  return "text-orange-600";
}

export function alertIcon(kind: AlertKind) {
  if (kind === "duplicate") return <Siren className="h-4 w-4" />;
  if (kind === "interaction") return <Pill className="h-4 w-4" />;
  if (kind === "machine") return <AlertTriangle className="h-4 w-4" />;
  if (kind === "stock") return <PackageCheck className="h-4 w-4" />;
  if (kind === "paper") return <CheckCircle2 className="h-4 w-4" />;
  return <Sparkles className="h-4 w-4" />;
}
