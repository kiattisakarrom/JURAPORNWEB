import { AlertTriangle, CheckCircle2, PackageCheck, Siren, Sparkles } from "lucide-react";
import type { AlertKind, PatientQueueItem, Priority } from "@/types/pharmacy";

export const alertStyles: Record<AlertKind, string> = {
  duplicate: "bg-[#fdeaea] text-[#d83a3a]",
  interaction: "border border-blue-300 bg-blue-50 text-blue-700",
  allergy: "border border-red-300 bg-red-50 text-red-700",
  machine: "bg-[#fff2e1] text-[#e07d12]",
  stock: "bg-[#fce7f3] text-[#be185d]",
  paper: "bg-[#fff5db] text-[#bd8208]",
  note: "bg-[#f0ecff] text-[#7a5cff]",
};

export const priorityStyles: Record<Priority, string> = {
  Stat: "text-[#e0392a]",
  "Re-work": "text-[#e07d12]",
  New: "text-[#9aa7b8]",
  Unspecified: "text-[#9aa7b8]",
};

export const stageStyles: Record<PatientQueueItem["stage"], string> = {
  verify: "bg-[#eef3ff] text-[#2f6bf3]",
  picking: "bg-[#f0ecff] text-[#7a5cff]",
  matching: "bg-[#fff2e1] text-[#e07d12]",
  checking: "bg-[#e7f6ec] text-[#16a34a]",
  dispensing: "bg-[#e2f5fb] text-[#0a8bb0]",
  pending: "bg-[#fff5db] text-[#bd8208]",
  complete: "bg-[#e7f6ec] text-[#15924a]",
  "missed-call": "bg-[#fdebeb] text-[#d83a3a]",
};

export const stageDotStyles: Record<PatientQueueItem["stage"], string> = {
  verify: "bg-[#2f6bf3]",
  picking: "bg-[#7a5cff]",
  matching: "bg-[#e07d12]",
  checking: "bg-[#16a34a]",
  dispensing: "bg-[#0a8bb0]",
  pending: "bg-[#bd8208]",
  complete: "bg-[#15924a]",
  "missed-call": "bg-[#d83a3a]",
};

export function stageLabel(stage: PatientQueueItem["stage"]) {
  if (stage === "missed-call") return "Missed-call";
  return stage.charAt(0).toUpperCase() + stage.slice(1);
}

export function durationClass(minutes?: number) {
  if (minutes === undefined) return "text-[#9aa7b8]";
  if (minutes <= 20) return "text-[#15924a]";
  if (minutes <= 30) return "text-[#bd8208]";
  return "text-[#d83a3a]";
}

export function alertIcon(kind: AlertKind) {
  if (kind === "duplicate") return <Siren className="h-4 w-4" />;
  if (kind === "interaction") return <span className="text-[11px] font-black">DI</span>;
  if (kind === "allergy") return <span className="text-[11px] font-black">AI</span>;
  if (kind === "machine") return <AlertTriangle className="h-4 w-4" />;
  if (kind === "stock") return <PackageCheck className="h-4 w-4" />;
  if (kind === "paper") return <CheckCircle2 className="h-4 w-4" />;
  return <Sparkles className="h-4 w-4" />;
}
