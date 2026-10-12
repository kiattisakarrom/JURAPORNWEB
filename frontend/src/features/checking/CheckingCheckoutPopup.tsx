"use client";

import { LanguageSwitcher } from "@/i18n/LanguageSwitcher";

import { useTranslation } from "@/i18n";

import { Activity, Pill, RotateCcw, Save, Search, UserRound, X } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCheckingCheckout } from "@/lib/pharmacy-api";
import { cn } from "@/lib/utils";
import type { CheckingCheckoutResponse, PatientQueueItem } from "@/types/pharmacy";
import { PatientProfilePopup } from "@/features/patient-profile/PatientProfilePopup";

export function CheckingCheckoutPopup({ patient, onClose }: { patient: PatientQueueItem; onClose: () => void }) {
  const { t } = useTranslation();
  const [isProfileOpen, setIsProfileOpen] = useState(true);
  const { data: checkout, isLoading } = useQuery({
    queryKey: ["checking-checkout", patient.id, patient.prescriptions?.[0]?.id],
    queryFn: () => getCheckingCheckout(patient),
  });

  function closeTopLayer() {
    if (isProfileOpen) {
      setIsProfileOpen(false);
      return;
    }

    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex h-dvh justify-end bg-slate-950/25 backdrop-blur-[1px]">
      <button aria-label={t("checking.closeCheckingScreen")} className="hidden flex-1 cursor-default lg:block" onClick={closeTopLayer} type="button" />
      <div className="flex h-full w-full justify-end gap-3 p-0 sm:p-3 lg:w-auto">
        {isProfileOpen ? <PatientProfilePopup patient={patient} onClose={() => setIsProfileOpen(false)} /> : null}
        <aside
          className={cn(
            "relative h-full w-full overflow-hidden border-l border-slate-200 bg-slate-100 shadow-2xl shadow-slate-900/20 sm:rounded-2xl sm:border",
            isProfileOpen
              ? "md:w-[calc(100vw-24px)] md:min-w-0 xl:w-[calc(100vw-556px)]"
              : "md:w-[calc(100vw-24px)] md:min-w-0",
          )}
        >
          <Button className="absolute right-4 top-4 z-20 bg-white/95 shadow-sm backdrop-blur hover:bg-white" onClick={closeTopLayer} size="icon" variant="ghost">
            <X className="h-5 w-5" />
          </Button>
          <div className="h-full overflow-y-auto p-5">
            {isLoading || !checkout ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm font-bold text-slate-500">{t("checking.loadingCheckingData")}</div>
            ) : (
              <CheckingCheckoutContent checkout={checkout} onOpenProfile={() => setIsProfileOpen(true)} />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function CheckingCheckoutContent({ checkout, onOpenProfile }: { checkout: CheckingCheckoutResponse; onOpenProfile: () => void }) {
  const { t } = useTranslation();
  const [basketLookup, setBasketLookup] = useState(checkout.basketLookup);
  const [scanCode, setScanCode] = useState("");
  const activeBasket = basketLookup.trim().toUpperCase();
  const visiblePrescriptions = checkout.prescriptions.map((prescription) => ({
    ...prescription,
    items: activeBasket ? prescription.items.filter((item) => item.basketCode.toUpperCase() === activeBasket) : prescription.items,
  }));
  const hasVisibleItems = visiblePrescriptions.some((prescription) => prescription.items.length > 0);

  return (
    <div className="flex min-h-full flex-col gap-4">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="mb-4 flex items-center gap-2 text-lg font-black text-slate-900">
              <Activity className="h-4 w-4 text-blue-600" />
              {t("common.checking")}</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <SummaryTile label={t("checking.totalPrescriptions")} tone="blue" value={t("checking.prescriptions", { p0: checkout.summary.prescriptions })} />
              <SummaryTile label={t("checking.totalBaskets")} tone="orange" value={t("checking.baskets", { p0: checkout.summary.baskets })} />
            </div>
          </div>

          <div className="grid gap-4">
            <div className="flex justify-end">
              <LanguageSwitcher />
              <Button className="bg-blue-50 text-blue-700 hover:bg-blue-100" onClick={onOpenProfile} variant="secondary">
                <UserRound className="h-4 w-4" />
                {t("common.subjective")}</Button>
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-black text-blue-700">
                <Search className="h-4 w-4" />
                {t("checking.basketLookup")}</div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="pl-9 font-black uppercase placeholder:normal-case placeholder:text-slate-400"
                  placeholder={t("checking.basketCode")}
                  value={basketLookup}
                  onChange={(event) => setBasketLookup(event.target.value.toUpperCase())}
                />
              </div>
              <p className={cn("mt-3 text-xs font-black", hasVisibleItems ? "text-emerald-600" : "text-orange-600")}>
                {hasVisibleItems && activeBasket ? t("checking.workingOnBasketTemporarilyLocked", { p0: activeBasket }) : t("checking.noMedicationFoundInThisBasket")}
              </p>
            </div>

            <div>
              <div className="relative">
                <Input
                  className="border-orange-200 font-bold text-orange-700 placeholder:text-orange-300 focus:border-orange-400 focus:ring-orange-100"
                  placeholder={t("checking.scanPackage")}
                  value={scanCode}
                  onChange={(event) => setScanCode(event.target.value)}
                />
              </div>
              <p className="mt-3 text-xs font-bold text-slate-400">{t("checking.confirmMedicationCodesWithAutoCheckboxFor")}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        {visiblePrescriptions.map((prescription, index) => {
          const hasActiveBasket = activeBasket ? prescription.baskets.includes(activeBasket) : prescription.items.length > 0;

          return (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" key={prescription.id}>
            <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <Badge className={hasActiveBasket ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-500"}>{t("checking.prescription")} {index + 1}</Badge>
                <span className="text-sm font-black text-slate-600">{t("checking.prescriptionNumber")} {prescription.rxNo}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-black text-slate-500">
                <span>{t("checking.basketsInThisPrescription")}</span>
                {prescription.baskets.map((basket) => (
                  <Badge className={basket === activeBasket ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200" : "bg-slate-100 text-slate-500"} key={basket}>
                    {basket}
                  </Badge>
                ))}
              </div>
            </div>

            {prescription.items.length ? (
              <div className="divide-y divide-slate-100">
                {prescription.items.map((item) => (
                  <CheckingDrugRow item={item} key={item.id} />
                ))}
              </div>
            ) : (
              <div className="bg-slate-50 px-4 py-8 text-center text-sm font-bold text-slate-400">
                {activeBasket ? t("checking.noMedicationInForThisPrescription", { p0: activeBasket }) : t("checking.enterABasketCodeToCheckMedication")}
              </div>
            )}
          </div>
          );
        })}
      </section>

      <div className="sticky bottom-0 -mx-5 -mb-5 mt-auto flex flex-col gap-3 px-4 pb-1 pt-4 sm:flex-row sm:justify-end">
        <Button variant="outline">
          <RotateCcw className="h-4 w-4" />
          {t("checking.holdReturnToPreviousStation")}</Button>
        <Button className="bg-orange-500 text-white hover:bg-orange-600">
          <Save className="h-4 w-4" />
          {t("checking.saveCheckoutCloseQueue")}</Button>
      </div>
    </div>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: string; tone: "blue" | "orange" }) {
  return (
    <div className={cn("rounded-2xl border p-5", tone === "blue" ? "border-blue-100 bg-blue-50 text-blue-700" : "border-orange-100 bg-orange-50 text-orange-600")}>
      <div className="text-sm font-bold text-slate-600">{label}</div>
      <div className="mt-2 text-3xl font-black">{value}</div>
    </div>
  );
}

function CheckingDrugRow({ item }: { item: CheckingCheckoutResponse["prescriptions"][number]["items"][number] }) {
  const { t } = useTranslation();
  const isChecked = item.status === "checked";
  const isLocked = item.status === "locked";

  return (
    <div className={cn("grid gap-4 px-5 py-5 lg:grid-cols-[34px_1.4fr_110px_minmax(280px,1fr)_90px]", isLocked && "bg-slate-50 opacity-60")}>
      <div className="flex items-center">
        <span className={cn("flex h-5 w-5 items-center justify-center rounded border text-white", isChecked ? "border-orange-500 bg-orange-500" : "border-slate-300 bg-white")}>
          {isChecked ? "✓" : ""}
        </span>
      </div>
      <div className="flex min-w-0 gap-3">
        <div className={cn("flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border", isLocked ? "border-slate-200 bg-slate-200 text-slate-400" : "border-slate-200 bg-white text-red-600")}>
          <Pill className="h-10 w-10" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-base font-black text-slate-900">{item.drugName}</div>
          <div className="mt-1 text-xs font-bold text-slate-400">{t("checking.dispensedOn")} {item.dispenseDate}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge className="bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">{item.diStatus}</Badge>
            <Badge className="bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">{item.allergyStatus}</Badge>
          </div>
        </div>
      </div>
      <div className="flex items-center text-base font-black text-slate-600">{item.quantity}</div>
      <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm font-bold leading-6 text-slate-500">
        <span className="text-blue-700">{t("common.directions")}</span> {item.instruction}
      </div>
      <div className="flex flex-col items-end justify-center gap-1 text-xs font-black">
        <Badge className={isLocked ? "bg-slate-200 text-slate-500" : "bg-blue-100 text-blue-700"}>{item.machineLabel}</Badge>
        <span className="text-emerald-600">{item.basketCode}</span>
      </div>
    </div>
  );
}
