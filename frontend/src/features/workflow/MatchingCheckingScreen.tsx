"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Barcode,
  CheckCircle2,
  ChevronRight,
  CircleCheck,
  Clock3,
  Filter,
  Info,
  LockKeyhole,
  PackageCheck,
  Printer,
  RefreshCw,
  ScanLine,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MedicationErrorReportModal } from "@/features/medication-error/MedicationErrorReportModal";
import { getWorkflowBaskets, type WorkflowBasketItem, type WorkflowStage } from "@/lib/workstation-api";
import { cn } from "@/lib/utils";

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

export function MatchingCheckingScreen({
  search,
  stage,
  onOpenChecking,
}: {
  search: string;
  stage: WorkflowStage;
  onOpenChecking: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [guideCode, setGuideCode] = useState("");
  const [medicineCode, setMedicineCode] = useState("");
  const [stickerCode, setStickerCode] = useState("");
  const [checkingDrugCode, setCheckingDrugCode] = useState("");
  const [guideError, setGuideError] = useState<string | null>(null);
  const [medicineError, setMedicineError] = useState<string | null>(null);
  const [checkingError, setCheckingError] = useState<string | null>(null);
  const [confirmedStickerItemId, setConfirmedStickerItemId] = useState<string | null>(null);
  const [selectedMedicationErrorItemId, setSelectedMedicationErrorItemId] = useState<string | null>(null);
  const [isMedicationErrorOpen, setIsMedicationErrorOpen] = useState(false);
  const [printedAt, setPrintedAt] = useState<Record<string, string>>({});
  const [checkedAt, setCheckedAt] = useState<Record<string, string>>({});
  const [itemStatus, setItemStatus] = useState<Record<string, WorkflowBasketItem["items"][number]["status"]>>({});
  const [basketStage, setBasketStage] = useState<Record<string, WorkflowStage>>({});
  const { data = [], isLoading } = useQuery({ queryKey: ["workflow-baskets"], queryFn: getWorkflowBaskets });

  const baskets = useMemo(
    () =>
      data.map((basket) => ({
        ...basket,
        stage: basketStage[basket.id] ?? basket.stage,
        items: basket.items.map((item) => ({
          ...item,
          status: itemStatus[item.id] ?? item.status,
        })),
      })),
    [basketStage, data, itemStatus],
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
    setConfirmedStickerItemId(null);
    setSelectedMedicationErrorItemId(null);
    setIsMedicationErrorOpen(false);
  }

  function findGuide(codeValue = guideCode) {
    const code = codeValue.trim().toLowerCase();
    if (!code) {
      setGuideError("กรุณากรอกรหัสใบนำทาง");
      return;
    }

    const basket = baskets.find((item) =>
      item.stage === stage
      && [item.guide, item.basket, item.vn].some((value) => value.toLowerCase() === code),
    );

    if (!basket) {
      setGuideError(`ไม่พบใบนำทางที่ระบุในรายการ ${stage === "matching" ? "Matching" : "Checking"}`);
      return;
    }

    selectBasket(basket);
  }

  function updateGuideCode(value: string) {
    setGuideCode(value);
    setGuideError(null);

    const code = value.trim().toLowerCase();
    if (!code) return;

    const basket = baskets.find((item) =>
      item.stage === stage
      && [item.guide, item.basket, item.vn].some((candidate) => candidate.toLowerCase() === code),
    );
    if (basket) selectBasket(basket);
  }

  function scanMedicine() {
    if (!selected || stage !== "matching") return;

    const code = medicineCode.trim().toLowerCase();
    if (!code) {
      setMedicineError("กรุณากรอกรหัสยา");
      return;
    }

    const item = selected.items.find((drug) => drug.code.toLowerCase() === code);
    if (!item) {
      setMedicineError("รหัสยานี้ไม่อยู่ในใบนำทางที่เลือก");
      return;
    }

    setItemStatus((current) => ({ ...current, [item.id]: "done" }));
    setPrintedAt((current) => ({ ...current, [item.id]: currentBangkokTime() }));
    setMedicineCode("");
    setMedicineError(null);
  }

  function reprintItem(item: WorkflowBasketItem["items"][number]) {
    setPrintedAt((current) => ({ ...current, [item.id]: currentBangkokTime() }));
  }

  function confirmSticker() {
    if (!selected || stage !== "checking") return;

    const code = stickerCode.trim().toLowerCase();
    if (!code) {
      setCheckingError("กรุณาสแกนรหัสสติกเกอร์");
      return;
    }

    const item = selected.items.find((drug) => drug.stickerCode.toLowerCase() === code);
    if (!item) {
      setCheckingError("รหัสสติกเกอร์นี้ไม่อยู่ในใบนำทางที่เลือก");
      setConfirmedStickerItemId(null);
      return;
    }

    if (item.status === "done") {
      setCheckingError("รายการยานี้ตรวจสอบผ่านแล้ว");
      setConfirmedStickerItemId(null);
      return;
    }

    setConfirmedStickerItemId(item.id);
    setCheckingError(null);
  }

  function verifyStickerWithDrug() {
    if (!selected || stage !== "checking") return;

    if (!confirmedStickerItemId) {
      setCheckingError("กรุณาสแกนรหัสสติกเกอร์ก่อน");
      return;
    }

    const code = checkingDrugCode.trim().toLowerCase();
    if (!code) {
      setCheckingError("กรุณาสแกนรหัสยาที่กล่อง");
      return;
    }

    const stickerItem = selected.items.find((item) => item.id === confirmedStickerItemId);
    const drugItem = selected.items.find((item) => item.code.toLowerCase() === code);
    if (!stickerItem || !drugItem || stickerItem.id !== drugItem.id) {
      setCheckingError("รหัสสติกเกอร์ไม่ตรงกับรหัสยาที่กล่อง กรุณาตรวจสอบอีกครั้ง");
      setStickerCode("");
      setCheckingDrugCode("");
      setConfirmedStickerItemId(null);
      return;
    }

    setItemStatus((current) => ({ ...current, [stickerItem.id]: "done" }));
    setCheckedAt((current) => ({ ...current, [stickerItem.id]: currentBangkokTime() }));
    setStickerCode("");
    setCheckingDrugCode("");
    setConfirmedStickerItemId(null);
    setCheckingError(null);
  }

  function sendSelectedToChecking() {
    if (!selected || selectedProgress?.done !== selectedProgress?.total) return;

    setBasketStage((current) => ({
      ...current,
      [selected.id]: "checking",
    }));
    setItemStatus((current) => {
      const next = { ...current };
      selected.items.forEach((item) => {
        next[item.id] = "wait";
      });
      return next;
    });
    setSelectedId(null);
    setSelectedMedicationErrorItemId(null);
    setIsMedicationErrorOpen(false);
    onOpenChecking();
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#f7f9fc]">
      {stage === "matching" ? (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-3 md:p-4 lg:grid-cols-[380px_minmax(0,1fr)] lg:overflow-hidden xl:grid-cols-[460px_minmax(0,1fr)] 2xl:grid-cols-[520px_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col gap-4 lg:overflow-y-auto">
            <section className="shrink-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <label className="block text-lg font-black text-slate-950" htmlFor="matching-guide-code">ค้นหาใบนำทาง</label>
              <div className="relative mt-3">
                <Barcode className="absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-slate-700" />
                <input
                  className="h-14 w-full rounded-xl border border-slate-300 bg-white pl-14 pr-16 text-sm font-semibold text-slate-800 shadow-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  id="matching-guide-code"
                  onChange={(event) => updateGuideCode(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") findGuide();
                  }}
                  placeholder="สแกนหรือกรอกรหัสใบนำทาง"
                  value={guideCode}
                />
                <button
                  aria-label="ยืนยันรหัสใบนำทาง"
                  className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700 transition hover:bg-blue-100"
                  onClick={() => findGuide()}
                  type="button"
                >
                  <ScanLine className="h-6 w-6" />
                </button>
              </div>
              <div className="mt-4 flex items-center gap-3 text-slate-500">
                <Info className="h-5 w-5 shrink-0" />
                <p className="text-sm font-bold md:text-base">เลือกใบนำทางจากรายการ หรือสแกนรหัสด้านบน</p>
              </div>
              {guideError ? <p className="mt-2 text-sm font-bold text-red-600" role="alert">{guideError}</p> : null}
            </section>

            {selected ? (
              <section className="shrink-0 rounded-2xl border border-blue-300 bg-blue-50 p-5 shadow-sm shadow-blue-100 md:p-6" aria-live="polite">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-mono text-lg font-black text-slate-950">ใบนำทาง {selected.guide}</h2>
                  <Badge className="shrink-0 bg-amber-50 px-3 py-1.5 text-amber-700">กำลัง Matching</Badge>
                </div>
                <div className="mt-4 text-lg font-black text-slate-900">{selected.name}</div>
                <div className="mt-3 grid grid-cols-2 divide-x divide-slate-200 text-sm font-bold text-slate-600">
                  <span>VN {selected.vn}</span>
                  <span className="pl-5">HN {selected.hn}</span>
                </div>
              </section>
            ) : null}

            <section className="flex min-h-[280px] flex-1 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
              <div className="flex items-center gap-3">
                <h2 className="text-base font-black text-slate-950 md:text-lg">รายการรอ Matching</h2>
                <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-lg bg-blue-600 px-2 text-sm font-black text-white">{filtered.length}</span>
                <div className="flex-1" />
                <button aria-label="รีเฟรชรายการ" className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-blue-300 hover:text-blue-700" type="button">
                  <RefreshCw className="h-5 w-5" />
                </button>
                <button aria-label="กรองรายการ" className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-blue-300 hover:text-blue-700" type="button">
                  <Filter className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 min-h-0 space-y-3 overflow-y-auto pr-1">
                {isLoading ? <div className="p-4 text-sm font-bold text-slate-400">กำลังโหลดข้อมูล...</div> : null}
                {!isLoading && filtered.length === 0 ? <div className="p-4 text-sm font-bold text-slate-400">ไม่พบรายการรอ Matching</div> : null}
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
                        <span className="mt-1 block font-mono text-xs font-bold text-slate-400">VN {basket.vn}</span>
                      </span>
                      <span className="text-right">
                        <span className="flex items-center justify-end gap-1 text-xs font-bold text-slate-500">
                          <Clock3 className="h-4 w-4" />
                          {isSelected ? "กำลัง Matching" : basket.waitingText ?? (index === 0 ? "รอ 3 นาที" : "เพิ่งส่งมา")}
                        </span>
                        <span className="mt-3 block text-base font-black text-blue-700">{basket.items.length} รายการ</span>
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
                  <h2 className="text-xl font-black text-slate-950 md:text-2xl">รายการยาในใบนำทาง</h2>
                  <div className="flex min-w-[220px] items-center gap-4">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${selectedProgress.percent}%` }} />
                    </div>
                    <div className="whitespace-nowrap font-mono text-xl font-black text-slate-900">
                      {selectedProgress.done}/{selectedProgress.total} <span className="font-sans text-sm">รายการ</span>
                    </div>
                  </div>
                </div>

                <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
                  <label className="text-sm font-black text-slate-700" htmlFor="matching-medicine-code">สแกนรหัสยา</label>
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
                        if (event.key === "Enter") scanMedicine();
                      }}
                      placeholder="กรอกรหัสยาเพื่อพิมพ์สติกเกอร์อัตโนมัติ"
                      value={medicineCode}
                    />
                    <button aria-label="ยืนยันรหัสยา" className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700 transition hover:bg-blue-100" onClick={scanMedicine} type="button">
                      <ScanLine className="h-6 w-6" />
                    </button>
                  </div>
                  {medicineError ? <p className="mt-2 text-sm font-bold text-red-600" role="alert">{medicineError}</p> : null}
                  <p className="mt-3 flex items-center gap-2 text-xs font-bold text-slate-500 md:text-sm">
                    <Info className="h-4 w-4 shrink-0" />
                    เมื่อรหัสถูกต้อง ระบบจะพิมพ์สติกเกอร์ทันที
                  </p>
                </section>

                <div className="mt-5 space-y-3">
                  {selected.items.map((item, index) => {
                    const isDone = item.status === "done";
                    const isSelectedForMedicationError = selectedMedicationErrorItemId === item.id;
                    return (
                      <div
                        aria-label={`เลือก ${item.name} เพื่อรายงาน ME`}
                        aria-pressed={isSelectedForMedicationError}
                        className={cn(
                          "grid cursor-pointer gap-3 rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 md:grid-cols-[48px_minmax(220px,1fr)_130px_190px_minmax(126px,auto)] md:items-center md:px-5",
                          isSelectedForMedicationError
                            ? "border-blue-400 bg-blue-50 shadow-sm shadow-blue-100 ring-1 ring-blue-200"
                            : isDone ? "border-emerald-200 bg-emerald-50/50 hover:border-blue-300" : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/40",
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
                          isDone ? "bg-emerald-500 text-white" : "border border-amber-200 bg-amber-50 text-amber-700",
                        )}>
                          {isDone ? <CheckCircle2 className="h-6 w-6" /> : index + 1}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="truncate text-base font-black text-slate-950 md:text-lg">{item.name}</div>
                            {isSelectedForMedicationError ? (
                              <span className="rounded-full bg-blue-600 px-2.5 py-1 text-xs font-black text-white">เลือกเพื่อรายงาน ME</span>
                            ) : null}
                          </div>
                          <div className="mt-1 font-mono text-xs font-bold text-slate-400">รหัสยา {item.code}</div>
                        </div>
                        <div>
                          <div className="font-mono text-lg font-black text-slate-800">{item.quantity}</div>
                          <div className="mt-1 text-xs font-bold text-slate-400">จำนวนที่จ่าย</div>
                        </div>
                        <div className={cn(
                          "text-sm font-black md:mr-6 md:justify-self-end md:text-right",
                          !isDone && "md:col-span-2",
                          isDone ? "text-emerald-600" : "text-amber-700",
                        )}>
                          {isDone ? (
                            <>
                              <span className="flex items-center gap-2"><CircleCheck className="h-4 w-4" />พิมพ์สติกเกอร์แล้ว</span>
                              <span className="mt-1 block font-mono font-bold text-slate-400">{printedAt[item.id] ?? item.printedAt ?? "พิมพ์แล้ว"}</span>
                            </>
                          ) : (
                            <span className="inline-flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2"><Clock3 className="h-4 w-4" />รอสแกนยา</span>
                          )}
                        </div>
                        {isDone ? (
                          <div>
                            <Button
                              className="w-full border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                              onClick={(event) => {
                                event.stopPropagation();
                                reprintItem(item);
                              }}
                              size="sm"
                              variant="outline"
                            >
                              <Printer className="h-4 w-4" />
                              พิมพ์ซ้ำ
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
                    <div className="font-black text-slate-800">ทำรายการยาให้ครบก่อนส่งต่อ</div>
                    <div className="mt-1 text-xs font-bold text-slate-500 md:text-sm">กรุณาสแกนโคดยาทั้งหมด {selectedProgress.done}/{selectedProgress.total} รายการ </div>
                  </div>
                </div>
                <div className="flex-1" />
                <Button
                  className="h-12 shrink-0 rounded-xl border-orange-200 px-5 text-orange-700 hover:bg-orange-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-100"
                  disabled={!selectedMedicationErrorItem}
                  onClick={() => setIsMedicationErrorOpen(true)}
                  title={selectedMedicationErrorItem ? `รายงาน ME สำหรับ ${selectedMedicationErrorItem.name}` : "กรุณาเลือกรายการยาที่พบปัญหาก่อน"}
                  variant="outline"
                >
                  <RefreshCw className="h-4 w-4" />
                  รายงาน ME
                </Button>
                <Button
                  className="h-12 shrink-0 rounded-xl bg-blue-600 px-6 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-white disabled:opacity-100"
                  disabled={selectedProgress.done !== selectedProgress.total}
                  onClick={sendSelectedToChecking}
                >
                  <LockKeyhole className="h-4 w-4" />
                  ส่งไปหน้า Checking
                </Button>
              </div>
            </section>
          ) : (
            <section aria-label="ยังไม่ได้เลือกใบนำทาง" className="hidden min-h-0 rounded-2xl border border-slate-200 bg-white shadow-sm lg:block" />
          )}
        </div>
      ) : (
        <CheckingWorkspace
          baskets={filtered}
          checkedAt={checkedAt}
          checkingDrugCode={checkingDrugCode}
          checkingError={checkingError}
          confirmedStickerItemId={confirmedStickerItemId}
          guideCode={guideCode}
          guideError={guideError}
          isLoading={isLoading}
          onConfirmSticker={confirmSticker}
          onFindGuide={findGuide}
          onOpenMedicationError={() => setIsMedicationErrorOpen(true)}
          onSelect={selectBasket}
          onSelectMedicationErrorItem={setSelectedMedicationErrorItemId}
          onUpdateDrugCode={(value) => {
            setCheckingDrugCode(value);
            setCheckingError(null);
          }}
          onUpdateGuideCode={updateGuideCode}
          onUpdateStickerCode={(value) => {
            setStickerCode(value);
            setCheckingError(null);
            setConfirmedStickerItemId(null);
          }}
          onVerifyPair={verifyStickerWithDrug}
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
    </div>
  );
}

function CheckingWorkspace({
  baskets,
  selected,
  isLoading,
  guideCode,
  guideError,
  stickerCode,
  checkingDrugCode,
  checkingError,
  confirmedStickerItemId,
  checkedAt,
  onSelect,
  onFindGuide,
  onUpdateGuideCode,
  onUpdateStickerCode,
  onUpdateDrugCode,
  onConfirmSticker,
  onVerifyPair,
  selectedMedicationErrorItemId,
  onSelectMedicationErrorItem,
  onOpenMedicationError,
}: {
  baskets: WorkflowBasketItem[];
  selected?: WorkflowBasketItem;
  isLoading: boolean;
  guideCode: string;
  guideError: string | null;
  stickerCode: string;
  checkingDrugCode: string;
  checkingError: string | null;
  confirmedStickerItemId: string | null;
  checkedAt: Record<string, string>;
  onSelect: (basket: WorkflowBasketItem) => void;
  onFindGuide: () => void;
  onUpdateGuideCode: (value: string) => void;
  onUpdateStickerCode: (value: string) => void;
  onUpdateDrugCode: (value: string) => void;
  onConfirmSticker: () => void;
  onVerifyPair: () => void;
  selectedMedicationErrorItemId: string | null;
  onSelectMedicationErrorItem: (id: string) => void;
  onOpenMedicationError: () => void;
}) {
  const selectedProgress = selected ? progressOf(selected) : undefined;
  const confirmedStickerItem = selected?.items.find((item) => item.id === confirmedStickerItemId);

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-3 md:p-4 lg:grid-cols-[380px_minmax(0,1fr)] lg:overflow-hidden xl:grid-cols-[460px_minmax(0,1fr)] 2xl:grid-cols-[520px_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col gap-4 lg:overflow-y-auto">
        <section className="shrink-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <label className="block text-lg font-black text-slate-950" htmlFor="checking-guide-code">ค้นหาใบนำทาง</label>
          <div className="relative mt-3">
            <Barcode className="absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-slate-700" />
            <input
              className="h-14 w-full rounded-xl border border-slate-300 bg-white pl-14 pr-16 text-sm font-semibold text-slate-800 shadow-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              id="checking-guide-code"
              onChange={(event) => onUpdateGuideCode(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onFindGuide();
              }}
              placeholder="สแกนหรือกรอกรหัสใบนำทาง"
              value={guideCode}
            />
            <button aria-label="ยืนยันรหัสใบนำทาง" className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700 transition hover:bg-blue-100" onClick={onFindGuide} type="button">
              <ScanLine className="h-6 w-6" />
            </button>
          </div>
          <div className="mt-4 flex items-center gap-3 text-slate-500">
            <Info className="h-5 w-5 shrink-0" />
            <p className="text-sm font-bold md:text-base">เลือกใบนำทางจากรายการ หรือสแกนรหัสด้านบน</p>
          </div>
          {guideError ? <p className="mt-2 text-sm font-bold text-red-600" role="alert">{guideError}</p> : null}
        </section>

        {selected ? (
          <section className="shrink-0 rounded-2xl border border-blue-300 bg-blue-50 p-5 shadow-sm shadow-blue-100 md:p-6" aria-live="polite">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-mono text-lg font-black text-slate-950">ใบนำทาง {selected.guide}</h2>
              <Badge className="shrink-0 bg-blue-100 px-3 py-1.5 text-blue-700">กำลัง Checking</Badge>
            </div>
            <div className="mt-4 text-lg font-black text-slate-900">{selected.name}</div>
            <div className="mt-3 grid grid-cols-2 divide-x divide-blue-200 text-sm font-bold text-slate-600">
              <span>VN {selected.vn}</span>
              <span className="pl-5">HN {selected.hn}</span>
            </div>
          </section>
        ) : null}

        <section className="flex min-h-[280px] flex-1 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-black text-slate-950 md:text-lg">รายการรอ Checking</h2>
            <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-lg bg-blue-600 px-2 text-sm font-black text-white">{baskets.length}</span>
            <div className="flex-1" />
            <button aria-label="รีเฟรชรายการ" className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-blue-300 hover:text-blue-700" type="button">
              <RefreshCw className="h-5 w-5" />
            </button>
            <button aria-label="กรองรายการ" className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-blue-300 hover:text-blue-700" type="button">
              <Filter className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-4 min-h-0 space-y-3 overflow-y-auto pr-1">
            {isLoading ? <div className="p-4 text-sm font-bold text-slate-400">กำลังโหลดข้อมูล...</div> : null}
            {!isLoading && baskets.length === 0 ? <div className="p-4 text-sm font-bold text-slate-400">ไม่พบรายการรอ Checking</div> : null}
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
                    <span className="mt-1 block font-mono text-xs font-bold text-slate-400">VN {basket.vn}</span>
                  </span>
                  <span className="text-right">
                    <span className="flex items-center justify-end gap-1 text-xs font-bold text-slate-500"><Clock3 className="h-4 w-4" />{isSelected ? "กำลัง Checking" : basket.waitingText ?? (index === 0 ? "รอ 2 นาที" : "เพิ่งส่งมา")}</span>
                    <span className="mt-3 block text-base font-black text-blue-700">{basket.items.length} รายการ</span>
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
              <h2 className="text-xl font-black text-slate-950 md:text-2xl">รายการยาในใบนำทาง</h2>
              <div className="flex min-w-[220px] items-center gap-4">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${selectedProgress.percent}%` }} />
                </div>
                <div className="whitespace-nowrap font-mono text-xl font-black text-slate-900">{selectedProgress.done}/{selectedProgress.total} <span className="font-sans text-sm">รายการ</span></div>
              </div>
            </div>

            <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
              <h3 className="text-base font-black text-slate-900">ตรวจสอบสติกเกอร์กับตัวยา</h3>
              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <div>
                  <label className="text-sm font-black text-slate-700" htmlFor="checking-sticker-code">1. สแกนรหัสสติกเกอร์</label>
                  <div className="relative mt-2">
                    <Barcode className="absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-slate-700" />
                    <input
                      className="h-14 w-full rounded-xl border border-slate-300 bg-white pl-14 pr-16 text-sm font-semibold text-slate-800 shadow-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      id="checking-sticker-code"
                      onChange={(event) => onUpdateStickerCode(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") onConfirmSticker();
                      }}
                      placeholder="สแกนรหัสบนสติกเกอร์ยา"
                      value={stickerCode}
                    />
                    <button aria-label="ยืนยันรหัสสติกเกอร์" className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700 transition hover:bg-blue-100" onClick={onConfirmSticker} type="button">
                      <ScanLine className="h-6 w-6" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-black text-slate-700" htmlFor="checking-drug-code">2. สแกนรหัสยาที่กล่อง</label>
                  <div className="relative mt-2">
                    <Barcode className="absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-slate-700" />
                    <input
                      className="h-14 w-full rounded-xl border border-slate-300 bg-white pl-14 pr-16 text-sm font-semibold text-slate-800 shadow-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                      disabled={!confirmedStickerItemId}
                      id="checking-drug-code"
                      onChange={(event) => onUpdateDrugCode(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") onVerifyPair();
                      }}
                      placeholder={confirmedStickerItemId ? "สแกนรหัสยาบนกล่องเพื่อตรวจสอบ" : "สแกนสติกเกอร์ก่อน"}
                      value={checkingDrugCode}
                    />
                    <button aria-label="ตรวจสอบรหัสยากับสติกเกอร์" className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700 transition enabled:hover:bg-blue-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400" disabled={!confirmedStickerItemId} onClick={onVerifyPair} type="button">
                      <ScanLine className="h-6 w-6" />
                    </button>
                  </div>
                </div>
              </div>

              {confirmedStickerItem ? (
                <p className="mt-4 flex items-center gap-2 rounded-xl bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">
                  <Info className="h-4 w-4 shrink-0" />
                  สแกนสติกเกอร์ของ {confirmedStickerItem.name} แล้ว กรุณาสแกนรหัสยาที่กล่องเพื่อตรวจสอบ
                </p>
              ) : (
                <p className="mt-4 flex items-center gap-2 text-xs font-bold text-slate-500 md:text-sm"><Info className="h-4 w-4 shrink-0" />ระบบจะผ่านรายการเมื่อรหัสสติกเกอร์และรหัสยาที่กล่องตรงกันเท่านั้น</p>
              )}
              {checkingError ? <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600" role="alert">{checkingError}</p> : null}
            </section>

            <div className="mt-5 space-y-3">
              {selected.items.map((item, index) => {
                const isDone = item.status === "done";
                const isPending = item.id === confirmedStickerItemId;
                const isSelectedForMedicationError = item.id === selectedMedicationErrorItemId;
                return (
                  <div
                    aria-label={`เลือก ${item.name} เพื่อรายงาน ME`}
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
                          <span className="rounded-full bg-blue-600 px-2.5 py-1 text-xs font-black text-white">เลือกเพื่อรายงาน ME</span>
                        ) : null}
                      </div>
                      <div className="mt-1 font-mono text-xs font-bold text-slate-400">รหัสยา {item.code}</div>
                    </div>
                    <div><div className="font-mono text-lg font-black text-slate-800">{item.quantity}</div><div className="mt-1 text-xs font-bold text-slate-400">จำนวนที่จ่าย</div></div>
                    <div><div className="font-mono text-sm font-black text-slate-700">{item.stickerCode}</div><div className="mt-1 text-xs font-bold text-slate-400">รหัสสติกเกอร์</div></div>
                    <div className={cn(
                      "text-sm font-black md:mr-6 md:justify-self-end md:text-right",
                      isDone ? "text-emerald-600" : isPending ? "text-blue-700" : "text-amber-700",
                    )}>
                      {isDone ? <><span className="flex items-center gap-2"><CircleCheck className="h-4 w-4" />ตรวจสอบตรงกันแล้ว</span><span className="mt-1 block font-mono font-bold text-slate-400">{checkedAt[item.id] ?? "ตรวจสอบแล้ว"}</span></> : isPending ? <span className="flex items-center gap-2"><ScanLine className="h-4 w-4" />รอสแกนรหัสยาที่กล่อง</span> : <span className="inline-flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2"><Clock3 className="h-4 w-4" />รอตรวจสอบ</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="m-4 mt-0 flex shrink-0 flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:m-6 md:mt-0 md:flex-row md:items-center md:p-5">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700">{selectedProgress.done === selectedProgress.total ? <CircleCheck className="h-5 w-5 text-emerald-600" /> : <LockKeyhole className="h-5 w-5" />}</div>
              <div><div className="font-black text-slate-800">ตรวจสอบยาให้ครบก่อนส่งต่อ</div><div className="mt-1 text-xs font-bold text-slate-500 md:text-sm">สติกเกอร์และรหัสยาต้องตรงกันครบ {selectedProgress.done}/{selectedProgress.total} รายการ</div></div>
            </div>
            <div className="flex-1" />
            <Button
              className="h-12 shrink-0 rounded-xl border-orange-200 px-5 text-orange-700 hover:bg-orange-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-100"
              disabled={!selectedMedicationErrorItemId}
              onClick={onOpenMedicationError}
              title={selectedMedicationErrorItemId ? "รายงาน ME สำหรับยาที่เลือก" : "กรุณาเลือกรายการยาที่พบปัญหาก่อน"}
              variant="outline"
            >
              <RefreshCw className="h-4 w-4" />
              รายงาน ME
            </Button>
            <Button className="h-12 shrink-0 rounded-xl bg-blue-600 px-6 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-white disabled:opacity-100" disabled={selectedProgress.done !== selectedProgress.total}>
              <PackageCheck className="h-4 w-4" />
              ส่ง AGV
            </Button>
          </div>
        </section>
      ) : (
        <section aria-label="ยังไม่ได้เลือกใบนำทาง" className="hidden min-h-0 rounded-2xl border border-slate-200 bg-white shadow-sm lg:block" />
      )}
    </div>
  );
}
