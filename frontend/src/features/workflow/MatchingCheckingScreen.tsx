"use client";

import { frontendErrorMessage, uiMessage, useTranslation, type UiMessage, Message } from "@/i18n";

import {
  Barcode,
  CheckCircle2,
  ChevronRight,
  CircleCheck,
  Clock3,
  Filter,
  Info,
  LockKeyhole,
  Loader2,
  NotebookPen,
  PackageCheck,
  Printer,
  RefreshCw,
  ScanLine,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MedicationErrorReportModal } from "@/features/medication-error/MedicationErrorReportModal";
import type { WorkflowBasketItem, WorkflowStage } from "@/lib/workstation-api";
import {
  mapPackageToBasket,
  scanPackageMatchingMedicine,
  transitionPackage,
  validatePackageCheckingPair,
  type PackagePage,
  type MedicationPackage,
} from "@/lib/package-workflow-api";
import { cn } from "@/lib/utils";
import { PackageNoteModal } from "./PackageNoteModal";
import { printPackageDrugLabel } from "@/lib/drug-label-api";
import { openDrugLabelPrint } from "@/lib/drug-label-print";

function progressOf(basket: WorkflowBasketItem) {
  const done = basket.items.filter((item) => item.status === "done").length;
  const doing = basket.items.some((item) => item.status === "doing");
  return {
    done,
    total: basket.items.length,
    percent: Math.round((done / basket.items.length) * 100),
    state: done === basket.items.length ? "done" : doing || done > 0 ? "doing" : "wait",
  } as const;
}

function currentBangkokTime() {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Bangkok",
  }).format(new Date());
}

function NoteButton({ hasNote, onClick }: { hasNote: boolean; onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <Button
      aria-label={hasNote ? t("workflow.openNoteNoteAvailable") : t("workflow.openNote")}
      className="relative h-10 rounded-xl border-blue-200 text-blue-700 hover:bg-blue-50"
      onClick={onClick}
      size="sm"
      variant="outline"
    >
      <NotebookPen className="h-4 w-4" />
      {t("common.note")}{hasNote ? (
        <span
          aria-label={t("workflow.noteAvailable")}
          className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[11px] font-black leading-none text-white shadow-sm ring-2 ring-white"
          role="img"
          title={t("workflow.noteAvailable")}
        >
          !
        </span>
      ) : null}
    </Button>
  );
}

export function MatchingCheckingScreen({
  search,
  stage,
  onOpenChecking,
  packages,
  isLoading,
  connected,
  onRefresh,
}: {
  search: string;
  stage: WorkflowStage;
  onOpenChecking: () => void;
  packages: MedicationPackage[];
  isLoading: boolean;
  connected: boolean;
  onRefresh: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [guideCode, setGuideCode] = useState("");
  const [medicineCode, setMedicineCode] = useState("");
  const [stickerCode, setStickerCode] = useState("");
  const [checkingDrugCode, setCheckingDrugCode] = useState("");
  const [guideError, setGuideError] = useState<string | UiMessage | null>(null);
  const [medicineError, setMedicineError] = useState<string | UiMessage | null>(null);
  const [checkingError, setCheckingError] = useState<string | UiMessage | null>(null);
  const [confirmedMedicineItemId, setConfirmedMedicineItemId] = useState<string | null>(null);
  const [selectedMedicationErrorItemId, setSelectedMedicationErrorItemId] = useState<string | null>(null);
  const [isMedicationErrorOpen, setIsMedicationErrorOpen] = useState(false);
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [printingItemId, setPrintingItemId] = useState<string | null>(null);
  const [checkedAt, setCheckedAt] = useState<Record<string, string>>({});
  const apiStage = stage.toUpperCase() as PackagePage;
  const itemPackages = useMemo(() => packages.filter(p => p.PAGE_NOW === apiStage), [packages, apiStage]);

  const baskets = useMemo(
    () => itemPackages.map((itemPackage) => mapPackageToBasket(itemPackage, stage)),
    [itemPackages, stage],
  );

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return baskets.filter((basket) => {
      const matchesStage = basket.stage === stage;
      const matchesSearch = !keyword || [basket.basket, basket.vn, basket.hn, basket.name, basket.guide].some((value) => value.toLowerCase().includes(keyword));
      return matchesStage && matchesSearch;
    });
  }, [baskets, search, stage]);

  const selected = filtered.find((basket) => basket.id === selectedId);
  const selectedPackage = itemPackages.find((itemPackage) => itemPackage.PACKAGE_ID === selectedId);
  const hasSelectedNote = Boolean(selectedPackage?.VERIFY_NOTE?.trim());
  const selectedProgress = selected ? progressOf(selected) : undefined;
  const selectedMedicationErrorItem = selected?.items.find((item) => item.id === selectedMedicationErrorItemId);

  function selectBasket(basket: WorkflowBasketItem) {
    setSelectedId(basket.id);
    setGuideError(null);
    setMedicineError(null);
    setCheckingError(null);
    setGuideCode("");
    setMedicineCode("");
    setStickerCode("");
    setCheckingDrugCode("");
    setConfirmedMedicineItemId(null);
    setSelectedMedicationErrorItemId(null);
    setIsMedicationErrorOpen(false);
    setIsNoteOpen(false);
  }

  function findGuide(codeValue = guideCode) {
    const code = codeValue.trim().toLowerCase();
    if (!code) {
      setGuideError(uiMessage("workflow.enterAGuideCode"));
      return;
    }

    const matches = baskets.filter((item) =>
      item.stage === stage
      && [item.guide, item.basket, item.vn, item.hn].some((value) => value.toLowerCase() === code),
    );
    if (matches.length > 1) {
      setGuideError(uiMessage("workflow.multipleVnsFoundSelectAGuideFrom"));
      return;
    }
    const basket = matches[0];

    if (!basket) {
      setGuideError(uiMessage("workflow.guideNotFoundInList", { p0: stage === "matching" ? uiMessage("common.matching") : uiMessage("common.checking") }));
      return;
    }

    selectBasket(basket);
  }

  function updateGuideCode(value: string) {
    setGuideCode(value);
    setGuideError(null);

    const code = value.trim().toLowerCase();
    if (!code) return;

    const matches = baskets.filter((item) =>
      item.stage === stage
      && [item.guide, item.basket, item.vn, item.hn].some((candidate) => candidate.toLowerCase() === code),
    );
    if (matches.length > 1) {
      setGuideError(uiMessage("workflow.multipleVnsFoundSelectAGuideFrom"));
      return;
    }
    const basket = matches[0];
    if (basket) selectBasket(basket);
  }

  async function refreshBaskets() {
    await onRefresh();
  }

  async function scanMedicine() {
    if (!connected) { setMedicineError(uiMessage("common.disconnectedWaitForCurrentData")); return; }
    if (!selected || stage !== "matching") return;

    const code = medicineCode.trim().toLowerCase();
    if (!code) {
      setMedicineError(uiMessage("workflow.enterADrugCode"));
      return;
    }

    const item = selected.items.find((drug) => drug.code.toLowerCase() === code && drug.status === "wait");
    if (!item) {
      setMedicineError(uiMessage("workflow.noMedicationAwaitingScanWithThisCode"));
      return;
    }
    setPrintingItemId(item.id);
    try {
      await scanPackageMatchingMedicine(selected.id, medicineCode.trim(), item.id);
    } catch (error) {
      setMedicineError(readWorkflowError(error));
      setPrintingItemId(null);
      return;
    }
    try {
      const printModel = await printPackageDrugLabel(selected.id, item.id);
      await openDrugLabelPrint(printModel);
      setMedicineCode("");
      setMedicineError(null);
      await refreshBaskets();
    } catch (error) {
      setMedicineError(uiMessage("workflow.medicationScannedButLabelPrintingFailedPrint", { p0: readWorkflowError(error) }));
      await refreshBaskets().catch(() => undefined);
    } finally {
      setPrintingItemId(null);
    }
  }

  async function reprintItem(item: WorkflowBasketItem["items"][number]) {
    if (!selected) return;
    setPrintingItemId(item.id);
    try {
      const printModel = await printPackageDrugLabel(selected.id, item.id);
      await openDrugLabelPrint(printModel);
      setMedicineError(null);
      await refreshBaskets();
    } catch (error) {
      setMedicineError(readWorkflowError(error));
    } finally {
      setPrintingItemId(null);
    }
  }

  function confirmCheckingMedicine() {
    if (!selected || stage !== "checking") return;

    const code = checkingDrugCode.trim().toLowerCase();
    if (!code) {
      setCheckingError(uiMessage("workflow.scanTheDrugCodeOnTheBox"));
      return;
    }

    const item = selected.items.find((drug) => drug.code.toLowerCase() === code);
    if (!item) {
      setCheckingError(uiMessage("workflow.drugCodeNotFoundScanTheLabel"));
      setConfirmedMedicineItemId("unknown-medicine-code");
      return;
    }

    if (item.status === "done") {
      setCheckingError(uiMessage("workflow.thisMedicationHasAlreadyPassedChecking"));
      setConfirmedMedicineItemId(null);
      return;
    }

    setConfirmedMedicineItemId(item.id);
    setCheckingError(null);
  }

  async function verifyStickerWithDrug() {
    if (!connected) { setCheckingError(uiMessage("common.disconnectedWaitForCurrentData")); return; }
    if (!selected || stage !== "checking") return;

    if (!confirmedMedicineItemId) {
      setCheckingError(uiMessage("workflow.scanTheDrugCodeOnTheBox2"));
      return;
    }

    if (!stickerCode.trim()) {
      setCheckingError(uiMessage("workflow.scanTheQrOnTheDrugLabel"));
      return;
    }

    const drugItem = selected.items.find((item) => item.id === confirmedMedicineItemId);
    const medicineCodeValue = drugItem?.code ?? checkingDrugCode.trim();

    try {
      const result = await validatePackageCheckingPair(selected.id, medicineCodeValue, stickerCode.trim());
      if (!result.MATCHED) {
        setCheckingError(result.MESSAGE);
        setStickerCode("");
        setCheckingDrugCode("");
        setConfirmedMedicineItemId(null);
        return;
      }
      if (drugItem) setCheckedAt((current) => ({ ...current, [drugItem.id]: currentBangkokTime() }));
      setStickerCode("");
      setCheckingDrugCode("");
      setConfirmedMedicineItemId(null);
      setCheckingError(null);
      await refreshBaskets();
    } catch (error) {
      setCheckingError(readWorkflowError(error));
    }
  }

  async function sendSelectedToChecking() {
    if (!connected) { setMedicineError(uiMessage("common.disconnectedWaitForCurrentData")); return; }
    if (!selected || selectedProgress?.done !== selectedProgress?.total) return;

    try {
      await transitionPackage(selected.id, "SEND_TO_CHECKING");
      await refreshBaskets();
      setSelectedId(null);
      setSelectedMedicationErrorItemId(null);
      setIsMedicationErrorOpen(false);
      onOpenChecking();
    } catch (error) {
      setMedicineError(readWorkflowError(error));
    }
  }

  async function sendSelectedToDispensing() {
    if (!connected) { setCheckingError(uiMessage("common.disconnectedWaitForCurrentData")); return; }
    if (!selected || selectedProgress?.done !== selectedProgress?.total) return;
    try {
      await transitionPackage(selected.id, "SEND_TO_DISPENSING");
      await refreshBaskets();
      setSelectedId(null);
    } catch (error) {
      setCheckingError(readWorkflowError(error));
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#f7f9fc]">
      {packages.find(p => p.PACKAGE_ID === selectedId)?.SOURCE_CHANGED ? <div role="status" className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">{t("workflow.sourcePrescriptionChangedAfterPackageCreationPackage")}</div> : null}
      {selectedId && !selected && !isLoading ? <div role="status" className="border-b border-blue-200 bg-blue-50 px-5 py-3 text-sm text-blue-800">{t("workflow.selectedRecordIsNoLongerOnThis")}</div> : null}
      {stage === "matching" ? (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-3 md:p-4 lg:grid-cols-[380px_minmax(0,1fr)] lg:overflow-hidden xl:grid-cols-[460px_minmax(0,1fr)] 2xl:grid-cols-[520px_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col gap-4 lg:overflow-y-auto">
            <section className="shrink-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <label className="block text-lg font-black text-slate-950" htmlFor="matching-guide-code">{t("workflow.findGuide")}</label>
              <div className="relative mt-3">
                <Barcode className="absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-slate-700" />
                <input
                  className="h-14 w-full rounded-xl border border-slate-300 bg-white pl-14 pr-16 text-sm font-semibold text-slate-800 shadow-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  id="matching-guide-code"
                  onChange={(event) => updateGuideCode(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") findGuide();
                  }}
                  placeholder={t("workflow.scanOrEnterGuideCode")}
                  value={guideCode}
                />
                <button
                  aria-label={t("workflow.confirmGuideCode")}
                  className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700 transition hover:bg-blue-100"
                  onClick={() => findGuide()}
                  type="button"
                >
                  <ScanLine className="h-6 w-6" />
                </button>
              </div>
              <div className="mt-4 flex items-center gap-3 text-slate-500">
                <Info className="h-5 w-5 shrink-0" />
                <p className="text-sm font-bold md:text-base">{t("workflow.selectAGuideFromTheListOr")}</p>
              </div>
              {guideError ? <p className="mt-2 text-sm font-bold text-red-600" role="alert"><Message value={guideError} /></p> : null}
            </section>

            {selected ? (
              <section className="shrink-0 rounded-2xl border border-blue-300 bg-blue-50 p-5 shadow-sm shadow-blue-100 md:p-6" aria-live="polite">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-mono text-lg font-black text-slate-950">{t("workflow.guide")} {selected.guide}</h2>
                  <Badge className="shrink-0 bg-amber-50 px-3 py-1.5 text-amber-700">{t("workflow.matching")}</Badge>
                </div>
                <div className="mt-4 text-lg font-black text-slate-900">{selected.name}</div>
                <div className="mt-3 grid grid-cols-2 divide-x divide-slate-200 text-sm font-bold text-slate-600">
                  <span>{t("common.vn")} {selected.vn}</span>
                  <span className="pl-5">{t("common.hn")} {selected.hn}</span>
                </div>
              </section>
            ) : null}

            <section className="flex min-h-[280px] flex-1 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
              <div className="flex items-center gap-3">
                <h2 className="text-base font-black text-slate-950 md:text-lg">{t("workflow.awaitingMatching")}</h2>
                <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-lg bg-blue-600 px-2 text-sm font-black text-white">{filtered.length}</span>
                <div className="flex-1" />
                <button aria-label={t("workflow.refreshList")} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-blue-300 hover:text-blue-700" type="button">
                  <RefreshCw className="h-5 w-5" />
                </button>
                <button aria-label={t("workflow.filterList")} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-blue-300 hover:text-blue-700" type="button">
                  <Filter className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 min-h-0 space-y-3 overflow-y-auto pr-1">
                {isLoading ? <div className="p-4 text-sm font-bold text-slate-400">{t("common.loadingData")}</div> : null}
                {!isLoading && filtered.length === 0 ? <div className="p-4 text-sm font-bold text-slate-400">{t("workflow.noRecordsAwaitingMatching")}</div> : null}
                {filtered.map((basket, index) => {
                  const isSelected = basket.id === selected?.id;
                  return (
                    <button
                      aria-pressed={isSelected}
                      className={cn(
                        "grid w-full grid-cols-[minmax(0,1fr)_auto_20px] items-center gap-3 rounded-xl border p-4 text-left transition focus-visible:border-blue-500",
                        isSelected
                          ? "border-blue-400 bg-blue-100 shadow-sm shadow-blue-100"
                          : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/50",
                      )}
                      key={basket.id}
                      onClick={() => selectBasket(basket)}
                      type="button"
                    >
                      <span className="min-w-0">
                        <span className="block font-mono text-base font-black text-slate-950">{basket.guide}</span>
                        <span className="mt-1 block truncate font-black text-slate-800">{basket.name}</span>
                        <span className="mt-1 block font-mono text-xs font-bold text-slate-400">{t("common.vn")} {basket.vn}</span>
                      </span>
                      <span className="text-right">
                        <span className="flex items-center justify-end gap-1 text-xs font-bold text-slate-500">
                          <Clock3 className="h-4 w-4" />
                          {isSelected ? t("workflow.matching") : basket.waitingText ?? (index === 0 ? t("workflow.waiting3Minutes") : t("workflow.justReceived"))}
                        </span>
                        <span className="mt-3 block text-base font-black text-blue-700">{basket.items.length}  {t("common.items")}</span>
                      </span>
                      <ChevronRight className={cn("h-5 w-5", isSelected ? "text-blue-700" : "text-slate-600")} />
                    </button>
                  );
                })}
              </div>
            </section>
          </aside>

          {selected && selectedProgress ? (
            <section className="flex min-h-[560px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:min-h-0">
              <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-xl font-black text-slate-950 md:text-2xl">{t("workflow.guideMedications")}</h2>
                    <NoteButton hasNote={hasSelectedNote} onClick={() => setIsNoteOpen(true)} />
                  </div>
                  <div className="flex min-w-[220px] items-center gap-4">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${selectedProgress.percent}%` }} />
                    </div>
                    <div className="whitespace-nowrap font-mono text-xl font-black text-slate-900">
                      {selectedProgress.done}/{selectedProgress.total} <span className="font-sans text-sm">{t("common.items")}</span>
                    </div>
                  </div>
                </div>

                <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
                  <label className="text-sm font-black text-slate-700" htmlFor="matching-medicine-code">{t("workflow.scanDrugCode")}</label>
                  <div className="relative mt-2">
                    <Barcode className="absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-slate-700" />
                    <input
                      className="h-14 w-full rounded-xl border border-slate-300 bg-white pl-14 pr-16 text-sm font-semibold text-slate-800 shadow-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      id="matching-medicine-code"
                      onChange={(event) => {
                        setMedicineCode(event.target.value);
                        setMedicineError(null);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void scanMedicine();
                      }}
                      placeholder={t("workflow.enterDrugCodeToPrintLabelAutomatically")}
                      value={medicineCode}
                    />
                    <button aria-label={t("workflow.confirmDrugCode")} className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700 transition hover:bg-blue-100" onClick={() => void scanMedicine()} type="button">
                      <ScanLine className="h-6 w-6" />
                    </button>
                  </div>
                  {medicineError ? <p className="mt-2 text-sm font-bold text-red-600" role="alert"><Message value={medicineError} /></p> : null}
                  <p className="mt-3 flex items-center gap-2 text-xs font-bold text-slate-500 md:text-sm">
                    <Info className="h-4 w-4 shrink-0" />
                    {t("workflow.aCorrectCodePrintsTheLabelImmediately")}</p>
                </section>

                <div className="mt-5 space-y-3">
                  {selected.items.map((item, index) => {
                    const isDone = item.status === "done";
                    const isWaitingPrint = item.status === "doing";
                    const isSelectedForMedicationError = selectedMedicationErrorItemId === item.id;
                    return (
                      <div
                        aria-label={t("workflow.selectToReportMe", { p0: item.name })}
                        aria-pressed={isSelectedForMedicationError}
                        className={cn(
                          "grid cursor-pointer gap-3 rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 md:grid-cols-[48px_minmax(220px,1fr)_130px_190px_minmax(126px,auto)] md:items-center md:px-5",
                          isSelectedForMedicationError
                            ? "border-blue-400 bg-blue-50 shadow-sm shadow-blue-100 ring-1 ring-blue-200"
                            : isDone ? "border-emerald-200 bg-emerald-50/50 hover:border-blue-300" : isWaitingPrint ? "border-blue-200 bg-blue-50/50 hover:border-blue-400" : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/40",
                        )}
                        key={item.id}
                        onClick={() => setSelectedMedicationErrorItemId(item.id)}
                        onKeyDown={(event) => {
                          if (event.target !== event.currentTarget) return;
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedMedicationErrorItemId(item.id);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <div className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-full text-base font-black",
                          isDone ? "bg-emerald-500 text-white" : isWaitingPrint ? "border border-blue-200 bg-blue-50 text-blue-700" : "border border-amber-200 bg-amber-50 text-amber-700",
                        )}>
                          {isDone ? <CheckCircle2 className="h-6 w-6" /> : index + 1}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="truncate text-base font-black text-slate-950 md:text-lg">{item.name}</div>
                            {isSelectedForMedicationError ? (
                              <span className="rounded-full bg-blue-600 px-2.5 py-1 text-xs font-black text-white">{t("common.selectedForMeReport")}</span>
                            ) : null}
                          </div>
                          <div className="mt-1 font-mono text-xs font-bold text-slate-400">{t("common.drugCode")} {item.code}</div>
                        </div>
                        <div>
                          <div className="font-mono text-lg font-black text-slate-800">{item.quantity}</div>
                          <div className="mt-1 text-xs font-bold text-slate-400">{t("workflow.dispensedQuantity")}</div>
                        </div>
                        <div className={cn(
                          "text-sm font-black md:mr-6 md:justify-self-end md:text-right",
                          item.status === "wait" && "md:col-span-2",
                          isDone ? "text-emerald-600" : isWaitingPrint ? "text-blue-700" : "text-amber-700",
                        )}>
                          {isDone ? (
                            <>
                              <span className="flex items-center gap-2"><CircleCheck className="h-4 w-4" />{t("workflow.labelPrinted")}</span>
                              <span className="mt-1 block font-mono font-bold text-slate-400">{item.printedAt ?? t("workflow.printed")}</span>
                            </>
                          ) : isWaitingPrint ? (
                            <span className="inline-flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2"><Printer className="h-4 w-4" />{t("workflow.scannedAwaitingPrint")}</span>
                          ) : (
                            <span className="inline-flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2"><Clock3 className="h-4 w-4" />{t("workflow.awaitingDrugScan")}</span>
                          )}
                        </div>
                        {isDone || isWaitingPrint ? (
                          <div>
                            <Button
                              className="w-full border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                              disabled={printingItemId === item.id}
                              onClick={(event) => {
                                event.stopPropagation();
                                void reprintItem(item);
                              }}
                              size="sm"
                              variant="outline"
                            >
                              {printingItemId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                              {isDone ? t("workflow.reprint") : t("workflow.printLabel")}
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="m-4 mt-0 flex shrink-0 flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:m-6 md:mt-0 md:flex-row md:items-center md:p-5">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700">
                    {selectedProgress.done === selectedProgress.total ? <CircleCheck className="h-5 w-5 text-emerald-600" /> : <LockKeyhole className="h-5 w-5" />}
                  </div>
                  <div>
                    <div className="font-black text-slate-800">{t("workflow.completeAllMedicationBeforeForwarding")}</div>
                    <div className="mt-1 text-xs font-bold text-slate-500 md:text-sm">{t("workflow.scanAllDrugCodes")} {selectedProgress.done}/{selectedProgress.total}  {t("common.items")} </div>
                  </div>
                </div>
                <div className="flex-1" />
                <Button
                  className="h-12 shrink-0 rounded-xl border-orange-200 px-5 text-orange-700 hover:bg-orange-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-100"
                  disabled={!selectedMedicationErrorItem}
                  onClick={() => setIsMedicationErrorOpen(true)}
                  title={selectedMedicationErrorItem ? t("common.meReportFor", { p0: selectedMedicationErrorItem.name }) : t("common.selectTheMedicationWithAnIssueFirst")}
                  variant="outline"
                >
                  <RefreshCw className="h-4 w-4" />
                  {t("common.reportMe")}</Button>
                <Button
                  className="h-12 shrink-0 rounded-xl bg-blue-600 px-6 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-white disabled:opacity-100"
                  disabled={selectedProgress.done !== selectedProgress.total}
                  onClick={() => void sendSelectedToChecking()}
                >
                  <LockKeyhole className="h-4 w-4" />
                  {t("workflow.sendToChecking")}</Button>
              </div>
            </section>
          ) : (
            <section aria-label={t("workflow.noGuideSelected")} className="hidden min-h-0 rounded-2xl border border-slate-200 bg-white shadow-sm lg:block" />
          )}
        </div>
      ) : (
        <CheckingWorkspace
          baskets={filtered}
          checkedAt={checkedAt}
          checkingDrugCode={checkingDrugCode}
          checkingError={checkingError}
          confirmedMedicineItemId={confirmedMedicineItemId}
          guideCode={guideCode}
          guideError={guideError}
          isLoading={isLoading}
          hasNote={hasSelectedNote}
          onConfirmMedicine={confirmCheckingMedicine}
          onFindGuide={findGuide}
          onOpenMedicationError={() => setIsMedicationErrorOpen(true)}
          onOpenNote={() => setIsNoteOpen(true)}
          onSelect={selectBasket}
          onSelectMedicationErrorItem={setSelectedMedicationErrorItemId}
          onSendToDispensing={() => void sendSelectedToDispensing()}
          onUpdateDrugCode={(value) => {
            setCheckingDrugCode(value);
            setCheckingError(null);
            setConfirmedMedicineItemId(null);
          }}
          onUpdateGuideCode={updateGuideCode}
          onUpdateStickerCode={(value) => {
            setStickerCode(value);
            setCheckingError(null);
          }}
          onVerifyPair={() => void verifyStickerWithDrug()}
          selected={selected}
          selectedMedicationErrorItemId={selectedMedicationErrorItemId}
          stickerCode={stickerCode}
        />
      )}

      {isMedicationErrorOpen && selectedMedicationErrorItem ? (
        <MedicationErrorReportModal
          drug={{
            code: selectedMedicationErrorItem.code,
            id: selectedMedicationErrorItem.id,
            name: selectedMedicationErrorItem.name,
            quantity: selectedMedicationErrorItem.quantity,
            source: selectedMedicationErrorItem.machine,
            stickerCode: selectedMedicationErrorItem.stickerCode,
          }}
          onClose={() => setIsMedicationErrorOpen(false)}
        />
      ) : null}

      {isNoteOpen && selectedPackage ? (
        <PackageNoteModal
          connected={connected}
          itemPackage={selectedPackage}
          onClose={() => setIsNoteOpen(false)}
          onSaved={refreshBaskets}
        />
      ) : null}
    </div>
  );
}

function CheckingWorkspace({
  baskets,
  selected,
  isLoading,
  hasNote,
  guideCode,
  guideError,
  stickerCode,
  checkingDrugCode,
  checkingError,
  confirmedMedicineItemId,
  checkedAt,
  onSelect,
  onFindGuide,
  onUpdateGuideCode,
  onUpdateStickerCode,
  onUpdateDrugCode,
  onConfirmMedicine,
  onVerifyPair,
  selectedMedicationErrorItemId,
  onSelectMedicationErrorItem,
  onOpenMedicationError,
  onOpenNote,
  onSendToDispensing,
}: {
  baskets: WorkflowBasketItem[];
  selected?: WorkflowBasketItem;
  isLoading: boolean;
  hasNote: boolean;
  guideCode: string;
  guideError: string | UiMessage | null;
  stickerCode: string;
  checkingDrugCode: string;
  checkingError: string | UiMessage | null;
  confirmedMedicineItemId: string | null;
  checkedAt: Record<string, string>;
  onSelect: (basket: WorkflowBasketItem) => void;
  onFindGuide: () => void;
  onUpdateGuideCode: (value: string) => void;
  onUpdateStickerCode: (value: string) => void;
  onUpdateDrugCode: (value: string) => void;
  onConfirmMedicine: () => void;
  onVerifyPair: () => void;
  selectedMedicationErrorItemId: string | null;
  onSelectMedicationErrorItem: (id: string) => void;
  onOpenMedicationError: () => void;
  onOpenNote: () => void;
  onSendToDispensing: () => void;
}) {
  const { t } = useTranslation();
  const selectedProgress = selected ? progressOf(selected) : undefined;
  const confirmedMedicineItem = selected?.items.find((item) => item.id === confirmedMedicineItemId);

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-3 md:p-4 lg:grid-cols-[380px_minmax(0,1fr)] lg:overflow-hidden xl:grid-cols-[460px_minmax(0,1fr)] 2xl:grid-cols-[520px_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col gap-4 lg:overflow-y-auto">
        <section className="shrink-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <label className="block text-lg font-black text-slate-950" htmlFor="checking-guide-code">{t("workflow.findGuide")}</label>
          <div className="relative mt-3">
            <Barcode className="absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-slate-700" />
            <input
              className="h-14 w-full rounded-xl border border-slate-300 bg-white pl-14 pr-16 text-sm font-semibold text-slate-800 shadow-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              id="checking-guide-code"
              onChange={(event) => onUpdateGuideCode(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onFindGuide();
              }}
              placeholder={t("workflow.scanOrEnterGuideCode")}
              value={guideCode}
            />
            <button aria-label={t("workflow.confirmGuideCode")} className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700 transition hover:bg-blue-100" onClick={onFindGuide} type="button">
              <ScanLine className="h-6 w-6" />
            </button>
          </div>
          <div className="mt-4 flex items-center gap-3 text-slate-500">
            <Info className="h-5 w-5 shrink-0" />
            <p className="text-sm font-bold md:text-base">{t("workflow.selectAGuideFromTheListOr")}</p>
          </div>
          {guideError ? <p className="mt-2 text-sm font-bold text-red-600" role="alert"><Message value={guideError} /></p> : null}
        </section>

        {selected ? (
          <section className="shrink-0 rounded-2xl border border-blue-300 bg-blue-50 p-5 shadow-sm shadow-blue-100 md:p-6" aria-live="polite">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-mono text-lg font-black text-slate-950">{t("workflow.guide")} {selected.guide}</h2>
              <Badge className="shrink-0 bg-blue-100 px-3 py-1.5 text-blue-700">{t("workflow.checking")}</Badge>
            </div>
            <div className="mt-4 text-lg font-black text-slate-900">{selected.name}</div>
            <div className="mt-3 grid grid-cols-2 divide-x divide-blue-200 text-sm font-bold text-slate-600">
              <span>{t("common.vn")} {selected.vn}</span>
              <span className="pl-5">{t("common.hn")} {selected.hn}</span>
            </div>
          </section>
        ) : null}

        <section className="flex min-h-[280px] flex-1 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-black text-slate-950 md:text-lg">{t("workflow.awaitingChecking")}</h2>
            <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-lg bg-blue-600 px-2 text-sm font-black text-white">{baskets.length}</span>
            <div className="flex-1" />
            <button aria-label={t("workflow.refreshList")} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-blue-300 hover:text-blue-700" type="button">
              <RefreshCw className="h-5 w-5" />
            </button>
            <button aria-label={t("workflow.filterList")} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-blue-300 hover:text-blue-700" type="button">
              <Filter className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-4 min-h-0 space-y-3 overflow-y-auto pr-1">
            {isLoading ? <div className="p-4 text-sm font-bold text-slate-400">{t("common.loadingData")}</div> : null}
            {!isLoading && baskets.length === 0 ? <div className="p-4 text-sm font-bold text-slate-400">{t("workflow.noRecordsAwaitingChecking")}</div> : null}
            {baskets.map((basket, index) => {
              const isSelected = basket.id === selected?.id;
              return (
                <button
                  aria-pressed={isSelected}
                  className={cn(
                    "grid w-full grid-cols-[minmax(0,1fr)_auto_20px] items-center gap-3 rounded-xl border p-4 text-left transition focus-visible:border-blue-500",
                    isSelected
                      ? "border-blue-400 bg-blue-100 shadow-sm shadow-blue-100"
                      : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/50",
                  )}
                  key={basket.id}
                  onClick={() => onSelect(basket)}
                  type="button"
                >
                  <span className="min-w-0">
                    <span className="block font-mono text-base font-black text-slate-950">{basket.guide}</span>
                    <span className="mt-1 block truncate font-black text-slate-800">{basket.name}</span>
                    <span className="mt-1 block font-mono text-xs font-bold text-slate-400">{t("common.vn")} {basket.vn}</span>
                  </span>
                  <span className="text-right">
                    <span className="flex items-center justify-end gap-1 text-xs font-bold text-slate-500"><Clock3 className="h-4 w-4" />{isSelected ? t("workflow.checking") : basket.waitingText ?? (index === 0 ? t("workflow.waiting2Minutes") : t("workflow.justReceived"))}</span>
                    <span className="mt-3 block text-base font-black text-blue-700">{basket.items.length}  {t("common.items")}</span>
                  </span>
                  <ChevronRight className={cn("h-5 w-5", isSelected ? "text-blue-700" : "text-slate-600")} />
                </button>
              );
            })}
          </div>
        </section>
      </aside>

      {selected && selectedProgress ? (
        <section className="flex min-h-[620px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:min-h-0">
          <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-xl font-black text-slate-950 md:text-2xl">{t("workflow.guideMedications")}</h2>
                <NoteButton hasNote={hasNote} onClick={onOpenNote} />
              </div>
              <div className="flex min-w-[220px] items-center gap-4">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${selectedProgress.percent}%` }} />
                </div>
                <div className="whitespace-nowrap font-mono text-xl font-black text-slate-900">{selectedProgress.done}/{selectedProgress.total} <span className="font-sans text-sm">{t("common.items")}</span></div>
              </div>
            </div>

            <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
              <h3 className="text-base font-black text-slate-900">{t("workflow.checkLabelAgainstMedication")}</h3>
              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <div>
                  <label className="text-sm font-black text-slate-700" htmlFor="checking-drug-code">{t("workflow.1ScanTheDrugCodeOnThe")}</label>
                  <div className="relative mt-2">
                    <Barcode className="absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-slate-700" />
                    <input
                      className="h-14 w-full rounded-xl border border-slate-300 bg-white pl-14 pr-16 text-sm font-semibold text-slate-800 shadow-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      id="checking-drug-code"
                      onChange={(event) => onUpdateDrugCode(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") onConfirmMedicine();
                      }}
                      placeholder={t("workflow.scanDrugCodeOnBox")}
                      value={checkingDrugCode}
                    />
                    <button aria-label={t("workflow.confirmDrugCode")} className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700 transition hover:bg-blue-100" onClick={onConfirmMedicine} type="button">
                      <ScanLine className="h-6 w-6" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-black text-slate-700" htmlFor="checking-sticker-code">{t("workflow.2ScanQrOnLabel")}</label>
                  <div className="relative mt-2">
                    <Barcode className="absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-slate-700" />
                    <input
                      className="h-14 w-full rounded-xl border border-slate-300 bg-white pl-14 pr-16 text-sm font-semibold text-slate-800 shadow-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                      disabled={!confirmedMedicineItemId}
                      id="checking-sticker-code"
                      onChange={(event) => onUpdateStickerCode(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") onVerifyPair();
                      }}
                      placeholder={confirmedMedicineItemId ? t("workflow.scanLabelQrToCheck") : t("workflow.scanTheDrugCodeOnTheBox3")}
                      value={stickerCode}
                    />
                    <button aria-label={t("workflow.checkDrugCodeAgainstLabel")} className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700 transition enabled:hover:bg-blue-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400" disabled={!confirmedMedicineItemId} onClick={onVerifyPair} type="button">
                      <ScanLine className="h-6 w-6" />
                    </button>
                  </div>
                </div>
              </div>

              {confirmedMedicineItem ? (
                <p className="mt-4 flex items-center gap-2 rounded-xl bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">
                  <Info className="h-4 w-4 shrink-0" />
                  {t("workflow.medicationScanned")}{confirmedMedicineItem.name} {t("workflow.scanTheLabelQrToCheck")}</p>
              ) : (
                <p className="mt-4 flex items-center gap-2 text-xs font-bold text-slate-500 md:text-sm"><Info className="h-4 w-4 shrink-0" />{t("workflow.anItemPassesOnlyWhenTheLabel")}</p>
              )}
              {checkingError ? <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600" role="alert"><Message value={checkingError} /></p> : null}
            </section>

            <div className="mt-5 space-y-3">
              {selected.items.map((item, index) => {
                const isDone = item.status === "done";
                const isPending = item.id === confirmedMedicineItemId;
                const isSelectedForMedicationError = item.id === selectedMedicationErrorItemId;
                return (
                  <div
                    aria-label={t("workflow.selectToReportMe", { p0: item.name })}
                    aria-pressed={isSelectedForMedicationError}
                    className={cn(
                      "grid cursor-pointer gap-3 rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 md:grid-cols-[48px_minmax(220px,1fr)_120px_170px_210px] md:items-center md:px-5",
                      isSelectedForMedicationError
                        ? "border-blue-400 bg-blue-50 shadow-sm shadow-blue-100 ring-1 ring-blue-200"
                        : isDone ? "border-emerald-200 bg-emerald-50/50 hover:border-blue-300" : isPending ? "border-blue-300 bg-blue-50 hover:border-blue-400" : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/40",
                    )}
                    key={item.id}
                    onClick={() => onSelectMedicationErrorItem(item.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelectMedicationErrorItem(item.id);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className={cn("flex h-10 w-10 items-center justify-center rounded-full text-base font-black", isDone ? "bg-emerald-500 text-white" : isPending ? "bg-blue-600 text-white" : "border border-amber-200 bg-amber-50 text-amber-700")}>{isDone ? <CheckCircle2 className="h-6 w-6" /> : index + 1}</div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate text-base font-black text-slate-950 md:text-lg">{item.name}</div>
                        {isSelectedForMedicationError ? (
                          <span className="rounded-full bg-blue-600 px-2.5 py-1 text-xs font-black text-white">{t("common.selectedForMeReport")}</span>
                        ) : null}
                      </div>
                      <div className="mt-1 font-mono text-xs font-bold text-slate-400">{t("common.drugCode")} {item.code}</div>
                    </div>
                    <div><div className="font-mono text-lg font-black text-slate-800">{item.quantity}</div><div className="mt-1 text-xs font-bold text-slate-400">{t("workflow.dispensedQuantity")}</div></div>
                    <div><div className="font-mono text-sm font-black text-slate-700">{item.stickerCode}</div><div className="mt-1 text-xs font-bold text-slate-400">{t("workflow.labelCode")}</div></div>
                    <div className={cn(
                      "text-sm font-black md:mr-6 md:justify-self-end md:text-right",
                      isDone ? "text-emerald-600" : isPending ? "text-blue-700" : "text-amber-700",
                    )}>
                      {isDone ? <><span className="flex items-center gap-2"><CircleCheck className="h-4 w-4" />{t("workflow.matchConfirmed")}</span><span className="mt-1 block font-mono font-bold text-slate-400">{checkedAt[item.id] ?? t("workflow.checked")}</span></> : isPending ? <span className="flex items-center gap-2"><ScanLine className="h-4 w-4" />{t("workflow.awaitingBoxDrugCode")}</span> : <span className="inline-flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2"><Clock3 className="h-4 w-4" />{t("workflow.awaitingCheck")}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="m-4 mt-0 flex shrink-0 flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:m-6 md:mt-0 md:flex-row md:items-center md:p-5">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700">{selectedProgress.done === selectedProgress.total ? <CircleCheck className="h-5 w-5 text-emerald-600" /> : <LockKeyhole className="h-5 w-5" />}</div>
              <div><div className="font-black text-slate-800">{t("workflow.checkAllMedicationBeforeForwarding")}</div><div className="mt-1 text-xs font-bold text-slate-500 md:text-sm">{t("workflow.labelAndDrugCodesMustMatchFor")} {selectedProgress.done}/{selectedProgress.total}  {t("common.items")}</div></div>
            </div>
            <div className="flex-1" />
            <Button
              className="h-12 shrink-0 rounded-xl border-orange-200 px-5 text-orange-700 hover:bg-orange-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-100"
              disabled={!selectedMedicationErrorItemId}
              onClick={onOpenMedicationError}
              title={selectedMedicationErrorItemId ? t("workflow.meReportForSelectedMedication") : t("common.selectTheMedicationWithAnIssueFirst")}
              variant="outline"
            >
              <RefreshCw className="h-4 w-4" />
              {t("common.reportMe")}</Button>
            <Button
              className="h-12 shrink-0 rounded-xl bg-blue-600 px-6 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-white disabled:opacity-100"
              disabled={selectedProgress.done !== selectedProgress.total}
              onClick={onSendToDispensing}
            >
              <PackageCheck className="h-4 w-4" />
              {t("workflow.sendToDispensing")}</Button>
          </div>
        </section>
      ) : (
        <section aria-label={t("workflow.noGuideSelected")} className="hidden min-h-0 rounded-2xl border border-slate-200 bg-white shadow-sm lg:block" />
      )}
    </div>
  );
}

function readWorkflowError(error: unknown) {
  return frontendErrorMessage(error, uiMessage("workflow.unableToSaveWorkflow"));
}
