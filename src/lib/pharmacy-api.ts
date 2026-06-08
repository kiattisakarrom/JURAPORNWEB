import { buildQueueResponse } from "@/lib/mock-pharmacy";
import type { PharmacyQueueResponse } from "@/types/pharmacy";

const MOCK_LATENCY_MS = 250;

export async function getPharmacyQueue(): Promise<PharmacyQueueResponse> {
  await new Promise((resolve) => globalThis.setTimeout(resolve, MOCK_LATENCY_MS));

  // Swap this function body with a real fetch when the backend is ready.
  // Example: return fetch("/api/pharmacy/queue").then((res) => res.json());
  return buildQueueResponse();
}
