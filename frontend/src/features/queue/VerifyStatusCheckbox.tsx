"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function VerifyStatusCheckbox({ checked, label }: { checked: boolean; label: string }) {
  return (
    <span className="inline-flex items-center" onClick={(event) => event.stopPropagation()}>
      <input
        aria-label={label}
        checked={checked}
        className="sr-only"
        disabled
        readOnly
        tabIndex={-1}
        type="checkbox"
      />
      <span
        aria-hidden="true"
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-[5px] border-2 transition-colors",
          checked
            ? "border-blue-700 bg-blue-600 text-white shadow-sm shadow-blue-200"
            : "border-blue-300 bg-blue-50 text-transparent",
        )}
      >
        <Check className="h-3.5 w-3.5 stroke-[3]" />
      </span>
    </span>
  );
}
