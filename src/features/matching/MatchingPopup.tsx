"use client";

import { Activity, ClipboardList, FileText, Play, Send, Search, ShoppingBasket, UserRound, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PatientProfilePopup } from "@/features/patient-profile/PatientProfilePopup";
import { getMatchingCheckout } from "@/lib/pharmacy-api";
import { cn } from "@/lib/utils";
import type { MatchingBasketItem, MatchingCheckoutResponse, MatchingMedicineItem, MatchingPrescriptionItem, PatientQueueItem } from "@/types/pharmacy";

export function MatchingPopup({ patient, onClose }: { patient: PatientQueueItem; onClose: () => void }) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [selectedPrescriptionId, setSelectedPrescriptionId] = useState<string | null>(null);
  const [selectedMedicineId, setSelectedMedicineId] = useState<string | null>(null);
  const { data: matching, isLoading } = useQuery({
    queryKey: ["matching-checkout", patient.id],
    queryFn: () => getMatchingCheckout(patient),
  });

  const selectedPrescription = matching?.prescriptions.find((prescription) => prescription.id === selectedPrescriptionId) ?? matching?.prescriptions[0];
  const selectedMedicine = selectedPrescription?.medicines.find((medicine) => medicine.id === selectedMedicineId) ?? selectedPrescription?.medicines[0];

  function closeTopLayer() {
    if (isProfileOpen) {
      setIsProfileOpen(false);
      return;
    }

    onClose();
  }

  function selectPrescription(prescription: MatchingPrescriptionItem) {
    setSelectedPrescriptionId(prescription.id);
    setSelectedMedicineId(prescription.medicines[0]?.id ?? null);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/25 backdrop-blur-[1px]">
      <button aria-label="ปิดหน้า Matching" className="hidden flex-1 cursor-default lg:block" onClick={closeTopLayer} type="button" />
      <div className="flex h-full w-full justify-end gap-3 p-0 sm:p-3 lg:w-auto">
        {isProfileOpen ? <PatientProfilePopup patient={patient} onClose={() => setIsProfileOpen(false)} /> : null}
        <aside
          className={cn(
            "relative h-full w-full overflow-hidden border-l border-slate-200 bg-white shadow-2xl shadow-slate-900/20 sm:rounded-2xl sm:border",
            isProfileOpen
              ? "md:w-[calc(100vw-24px)] md:min-w-0 xl:w-[calc(100vw-556px)]"
              : "md:w-[calc(100vw-24px)] md:min-w-0",
          )}
        >
          <Button className="absolute right-4 top-4 z-20 bg-white/95 shadow-sm backdrop-blur hover:bg-white" onClick={closeTopLayer} size="icon" variant="ghost">
            <X className="h-5 w-5" />
          </Button>
          <div className="h-full overflow-y-auto bg-white p-5">
            {isLoading || !matching || !selectedPrescription || !selectedMedicine ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm font-bold text-slate-500">กำลังโหลดข้อมูล Matching...</div>
            ) : (
              <MatchingContent
                matching={matching}
                selectedMedicine={selectedMedicine}
                selectedPrescription={selectedPrescription}
                onOpenProfile={() => setIsProfileOpen(true)}
                onSelectMedicine={(medicineId) => setSelectedMedicineId(medicineId)}
                onSelectPrescription={selectPrescription}
              />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function MatchingContent({
  matching,
  selectedPrescription,
  selectedMedicine,
  onOpenProfile,
  onSelectPrescription,
  onSelectMedicine,
}: {
  matching: MatchingCheckoutResponse;
  selectedPrescription: MatchingPrescriptionItem;
  selectedMedicine: MatchingMedicineItem;
  onOpenProfile: () => void;
  onSelectPrescription: (prescription: MatchingPrescriptionItem) => void;
  onSelectMedicine: (medicineId: string) => void;
}) {
  const [prescriptionSearch, setPrescriptionSearch] = useState("");
  const [medicineSearch, setMedicineSearch] = useState("");
  const [basketSearch, setBasketSearch] = useState("");
  const prescriptionKeyword = prescriptionSearch.trim().toLowerCase();
  const medicineKeyword = medicineSearch.trim().toLowerCase();
  const basketKeyword = basketSearch.trim().toLowerCase();
  const visiblePrescriptions = matching.prescriptions.filter((prescription) => {
    if (!prescriptionKeyword) return true;

    return [
      prescription.presNo,
      prescription.createdDate,
      ...prescription.medicines.flatMap((medicine) => [
        medicine.medicineName,
        medicine.medicineCode,
        ...medicine.baskets.flatMap((basket) => [basket.basketId, basket.rxNo]),
      ]),
    ].some((value) => value.toLowerCase().includes(prescriptionKeyword));
  });
  const visibleMedicines = selectedPrescription.medicines.filter((medicine) => {
    if (!medicineKeyword) return true;

    return [medicine.medicineName, medicine.medicineCode].some((value) => value.toLowerCase().includes(medicineKeyword));
  });
  const visibleBaskets = selectedMedicine.baskets.filter((basket) => {
    if (!basketKeyword) return true;

    return [basket.basketId, basket.rxNo].some((value) => value.toLowerCase().includes(basketKeyword));
  });

  return (
    <div className="flex min-h-full flex-col gap-4">
      <div className="flex flex-col gap-3 pr-12 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-4 flex items-center gap-2 text-lg font-black text-slate-900">
            <Activity className="h-4 w-4 text-blue-600" />
            Matching
          </div>
        </div>
        <Button className="bg-blue-50 text-blue-700 hover:bg-blue-100" onClick={onOpenProfile} variant="secondary">
          <UserRound className="h-4 w-4" />
          ดูโปรไฟล์
        </Button>
      </div>

      <MatchingSection
        icon={<ClipboardList className="h-5 w-5 text-blue-600" />}
        searchValue={prescriptionSearch}
        searchPlaceholder={matching.prescriptionSearchPlaceholder}
        title="ข้อมูลใบสั่งยา (Prescriptions)"
        onSearchChange={setPrescriptionSearch}
      >
        <div className="grid grid-cols-[minmax(180px,1fr)_minmax(160px,0.8fr)] border-b border-slate-100 px-5 py-3 text-xs font-black uppercase text-blue-700">
          <span>PresNo.</span>
          <span>CreatedDate</span>
        </div>
        <div className="max-h-52 overflow-y-auto p-3">
          {visiblePrescriptions.length ? visiblePrescriptions.map((prescription) => (
            <button
              className={cn(
                "grid w-full grid-cols-[minmax(180px,1fr)_minmax(160px,0.8fr)] items-center rounded-xl px-3 py-3 text-left transition hover:bg-blue-50",
                selectedPrescription.id === prescription.id && "border-l-4 border-blue-600 bg-blue-50 shadow-sm",
              )}
              key={prescription.id}
              onClick={() => onSelectPrescription(prescription)}
              type="button"
            >
              <span className="flex items-center gap-3 font-black text-blue-700">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500 text-white">
                  <FileText className="h-4 w-4" />
                </span>
                {prescription.presNo}
              </span>
              <span className="font-semibold text-blue-950">{prescription.createdDate}</span>
            </button>
          )) : (
            <div className="px-3 py-6 text-center text-sm font-bold text-slate-400">ไม่พบข้อมูลใบสั่งยาที่ค้นหา</div>
          )}
        </div>
      </MatchingSection>

      <MatchingSection
        icon={<PillIcon />}
        searchValue={medicineSearch}
        searchPlaceholder={matching.medicineSearchPlaceholder}
        title="รายการยาในใบสั่งยา"
        onSearchChange={setMedicineSearch}
      >
        <div className="grid grid-cols-[minmax(220px,1fr)_90px_150px_90px] gap-3 border-b border-slate-100 px-6 py-3 text-xs font-black uppercase text-blue-700 max-lg:hidden">
          <span>Medicine Name</span>
          <span className="text-center">Qty</span>
          <span className="text-center">Status</span>
          <span className="text-center">Action</span>
        </div>
        <div className="max-h-56 overflow-y-auto p-3">
          {visibleMedicines.length ? visibleMedicines.map((medicine, index) => (
            <button
              className={cn(
                "grid w-full gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-blue-50 lg:grid-cols-[minmax(220px,1fr)_90px_150px_90px] lg:items-center",
                selectedMedicine.id === medicine.id && "bg-blue-50 shadow-sm ring-1 ring-blue-100",
              )}
              key={medicine.id}
              onClick={() => onSelectMedicine(medicine.id)}
              type="button"
            >
              <span className="flex min-w-0 gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-sm font-black text-slate-700">
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-black text-blue-700">{medicine.medicineName}</span>
                  <span className="mt-1 block text-xs font-semibold text-slate-500">ID: {medicine.medicineCode}</span>
                </span>
              </span>
              <span className="text-center font-black text-blue-950">{medicine.quantity}</span>
              <span className="flex justify-center">
                <MedicineStatusBadge status={medicine.status} />
              </span>
              <span className="text-center font-black text-slate-500">-</span>
            </button>
          )) : (
            <div className="px-3 py-6 text-center text-sm font-bold text-slate-400">ไม่พบรายการยาที่ค้นหา</div>
          )}
        </div>
      </MatchingSection>

      <MatchingSection
        icon={<ShoppingBasket className="h-5 w-5 text-blue-600" />}
        searchValue={basketSearch}
        searchPlaceholder={matching.basketSearchPlaceholder}
        title="รายการตะกร้าในระบบ"
        tone="orange"
        onSearchChange={setBasketSearch}
      >
        <div className="max-h-60 overflow-y-auto p-3">
          {visibleBaskets.length ? visibleBaskets.map((basket, index) => (
            <BasketRow basket={basket} index={index} key={basket.id} />
          )) : (
            <div className="px-3 py-6 text-center text-sm font-bold text-slate-400">ไม่พบรายการตะกร้าที่ค้นหา</div>
          )}
        </div>
      </MatchingSection>

      <div className="sticky bottom-0 -mx-5 -mb-5 mt-auto flex flex-col gap-3 px-4 pb-1 pt-4 sm:flex-row sm:justify-end">
        <Button className="border-orange-300 text-orange-700 hover:bg-orange-50 hover:text-orange-800" variant="outline">
          <Send className="h-4 w-4" />
          ส่งจัดยา
        </Button>
      </div>
    </div>
  );
}

function MatchingSection({
  title,
  icon,
  searchPlaceholder,
  searchValue,
  tone = "blue",
  children,
  onSearchChange,
}: {
  title: string;
  icon: ReactNode;
  searchPlaceholder: string;
  searchValue?: string;
  tone?: "blue" | "orange";
  children: ReactNode;
  onSearchChange?: (value: string) => void;
}) {
  return (
    <section className={cn("overflow-hidden rounded-2xl border bg-white shadow-sm", tone === "orange" ? "border-orange-100 bg-orange-50/35" : "border-slate-200")}>
      <div className={cn("grid gap-3 border-b p-4 lg:grid-cols-[1fr_minmax(260px,420px)] lg:items-center", tone === "orange" ? "border-orange-100 bg-orange-50/80" : "border-slate-100 bg-white")}>
        <div className="flex items-center gap-3 text-lg font-black text-blue-800">
          {icon}
          {title}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="bg-white pl-9 font-bold placeholder:text-slate-400"
            placeholder={searchPlaceholder}
            readOnly={!onSearchChange}
            value={onSearchChange ? searchValue : searchPlaceholder}
            onChange={(event) => onSearchChange?.(event.target.value)}
          />
        </div>
      </div>
      {children}
    </section>
  );
}

function MedicineStatusBadge({ status }: { status: MatchingMedicineItem["status"] }) {
  if (status === "waiting-match") {
    return (
      <Badge className="bg-orange-50 text-orange-700 ring-1 ring-orange-100">
        <span className="mr-2 h-2 w-2 rounded-full bg-orange-500" />
        รอการแมช
      </Badge>
    );
  }

  return (
    <Badge className="bg-blue-50 text-blue-800 ring-1 ring-blue-100">
      <span className="mr-2 h-2 w-2 rounded-full bg-blue-300" />
      ตรวจแล้ว
    </Badge>
  );
}

function BasketRow({ basket, index }: { basket: MatchingBasketItem; index: number }) {
  return (
    <div className="grid gap-3 rounded-xl px-3 py-3 text-sm transition hover:bg-orange-50 sm:grid-cols-[40px_minmax(160px,1fr)_minmax(130px,0.8fr)_120px_96px] sm:items-center">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-200 text-sm font-black text-slate-700">
        {index + 1}
      </span>
      <span className="font-semibold text-slate-700">
        Basket ID: <span className="ml-2 font-black text-blue-950">{basket.basketId}</span>
      </span>
      <span className="font-semibold text-slate-500">
        Rx No: <span>{basket.rxNo}</span>
      </span>
      <BasketStatusBadge status={basket.status} />
      <Button className="border-blue-200 text-blue-700 hover:bg-blue-50" size="sm" variant="outline">
        <Play className="h-3.5 w-3.5 fill-current" />
        เรียกดู
      </Button>
    </div>
  );
}

function BasketStatusBadge({ status }: { status: MatchingBasketItem["status"] }) {
  if (status === "verified") {
    return <Badge className="w-fit bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">Verify</Badge>;
  }

  if (status === "checking") {
    return <Badge className="w-fit bg-orange-50 text-orange-700 ring-1 ring-orange-100">กำลังตรวจสอบ</Badge>;
  }

  return <Badge className="w-fit bg-orange-50 text-orange-700 ring-1 ring-orange-100">กำลังตรวจสอบ</Badge>;
}

function PillIcon() {
  return (
    <span className="relative h-5 w-5 text-blue-600">
      <span className="absolute left-0 top-1 h-3 w-5 rotate-[-35deg] rounded-full bg-blue-600" />
      <span className="absolute right-0 top-2 h-2 w-2 rounded-full bg-blue-300" />
    </span>
  );
}
