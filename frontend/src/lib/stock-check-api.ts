import type { PatientQueueItem, StockCheckResponse } from "@/types/pharmacy";

const MOCK_LATENCY_MS = 350;

export async function getMachineStockCheck(patient: PatientQueueItem): Promise<StockCheckResponse> {
  await new Promise((resolve) => globalThis.setTimeout(resolve, MOCK_LATENCY_MS));

  // Replace this mock with a dedicated API when the machine/stock service is ready.
  // Example: return fetch(`/api/machine-stock-check?patientId=${patient.id}`).then((res) => res.json());
  const items = patient.drugs.map((drug, index) => {
    const isPatientBClopidogrel = patient.id === "pt-b" && drug.name === "Clopidogrel 75mg";
    const required = drug.name === "Clopidogrel 75mg" ? 30 : drug.name.includes("Metformin") ? 60 : 30;
    const available = isPatientBClopidogrel ? 5 : index === 0 ? 88 : 76;

    return {
      id: `${patient.id}-${drug.id}-stock`,
      drugId: drug.id,
      drugName: drug.name,
      machineName: drug.source,
      machineCode: drug.machineCode,
      available,
      required,
      capacity: 100,
    };
  });

  const shortage = items.find((item) => item.available < item.required);

  return {
    patientId: patient.id,
    checkedAt: new Date().toISOString(),
    items,
    canSetPending: !shortage,
    shortageMessage: shortage
      ? `${shortage.machineName} (${shortage.machineCode}) - ${shortage.drugName}: มีเพียง ${shortage.available} (ต้องการ ${shortage.required})`
      : undefined,
  };
}
