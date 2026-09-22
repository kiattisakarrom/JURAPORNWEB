import { apiDelete, apiGet, apiPost, createApiUrl } from "@/lib/api-client";

export type DispensingQueueItem = {
  PACKAGE_ID: string;
  WORKFLOW_ID: string;
  PACKAGE_NUMBER: string;
  PAGE_NOW: "AWAITING_DISPENSING" | "DISPENSING" | "COMPLETE";
  DISPENSING_PICKUP_STATUS: "WAITING_CALL" | "CALLED_WAITING" | "MISSED_CALL" | "RECEIVED" | null;
  DISPENSING_CHANNEL: number;
  QUEUE_READY_AT: string | null;
  CHECKING_COMPLETED_AT: string | null;
  LAST_CALLED_AT: string | null;
  RECEIVED_AT: string | null;
  CALL_COUNT: number;
  ROW_VERSION: string;
  VISITDATETIME: string;
  VISITNUMBER: string;
  PATIENTID: string | null;
  PATIENT_NAME: string | null;
  VERIFY_NOTE: string | null;
  ITEM_COUNT: number;
};

export type DispensingChannel = { CHANNEL_NO: number; OCCUPIED: boolean };
export type DispensingQueueResponse = {
  CURSOR: string;
  UPSERTS: DispensingQueueItem[];
  REMOVED_IDS?: string[];
  CHANNELS: DispensingChannel[];
};

export function getDispensingQueue() { return apiGet<DispensingQueueResponse>("/dispensing/queue"); }
export function getDispensingChanges(cursor: string) {
  return apiGet<DispensingQueueResponse>("/dispensing/queue/changes", { query: { cursor } });
}
export function claimDispensingChannel(channel: number, claimToken: string) {
  return apiPost<{ CHANNEL_NO: number; CLAIMED: boolean }>(`/dispensing/channels/${channel}/claim`, { claimToken });
}
export function validateDispensingChannelClaim(channel: number, claimToken: string) {
  return apiPost<{ CHANNEL_NO: number; CLAIMED: boolean }>(`/dispensing/channels/${channel}/claim/validate`, { claimToken });
}
export function releaseDispensingChannel(channel: number, claimToken: string) {
  return apiDelete<{ CHANNEL_NO: number; CLAIMED: boolean }>(`/dispensing/channels/${channel}/claim`, { claimToken });
}
export function releaseDispensingChannelOnPageClose(channel: number, claimToken: string) {
  if (typeof window === "undefined") return false;
  const url = createApiUrl(`/dispensing/channels/${channel}/claim/release-on-close`);
  const body = new URLSearchParams({ claimToken });
  if (typeof navigator.sendBeacon === "function" && navigator.sendBeacon(url.toString(), body)) return true;
  void fetch(url, {
    body,
    cache: "no-store",
    keepalive: true,
    method: "POST",
  }).catch(() => undefined);
  return true;
}
export function forceReleaseDispensingChannel(channel: number, input: {
  username: string; password: string; reason: string;
}) {
  return apiPost<{ CHANNEL_NO: number; CLAIMED: boolean }>(`/dispensing/channels/${channel}/force-release`, input);
}
export function transferDispensingPackage(packageId: string, channel: number, input: {
  claimToken: string; actionId: string; expectedRowVersion: string;
}) {
  return apiPost<{ PACKAGE_ID: string; CHANNEL_NO: number }>(`/dispensing/packages/${packageId}/transfer/${channel}`, input);
}
export function getDispensingHistory(fromDate: string, toDate: string, page: number) {
  return apiGet<{ PAGE: number; ITEMS: DispensingQueueItem[]; HAS_MORE: boolean }>("/dispensing/history", {
    query: { fromDate, toDate, page },
  });
}
