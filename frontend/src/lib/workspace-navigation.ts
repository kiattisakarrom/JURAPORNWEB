import type { WorkspaceScreen } from "@/features/shell/shell-types";
import type { QueueStage } from "@/types/pharmacy";

export const workspacePathByScreen: Record<WorkspaceScreen, string> = {
  verify: "/verify",
  matching: "/matching",
  checking: "/checking",
  dispensing: "/dispensing",
  dashboard: "/dashboard",
  me: "/me-report",
};

const screenByPath = new Map(Object.entries(workspacePathByScreen).map(([screen, pathname]) => [pathname, screen as WorkspaceScreen]));
const verifyTabs = new Set<QueueStage>(["all", "verify", "picking", "matching", "checking", "dispensing", "pending", "complete", "missed-call"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type WorkspacePopupTarget =
  | { kind: "workflow"; id: string; pn: string }
  | { kind: "package"; id: string; pn: string };

export type WorkspaceNavigationState = {
  tab: QueueStage;
  fromDate: string;
  toDate: string;
  popup: WorkspacePopupTarget | null;
  needsCleanup: boolean;
};

export function workspaceScreenFromPathname(pathname: string): WorkspaceScreen | null {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return screenByPath.get(normalized) ?? null;
}

export function parseWorkspaceNavigation(search: string, fallbackDate: string): WorkspaceNavigationState {
  const params = new URLSearchParams(search);
  const rawTab = params.get("tab");
  const tab = rawTab && verifyTabs.has(rawTab as QueueStage) ? rawTab as QueueStage : "verify";
  const rawFromDate = params.get("from");
  const rawToDate = params.get("to");
  const hasValidDates = isIsoDate(rawFromDate) && isIsoDate(rawToDate) && rawFromDate <= rawToDate;
  const fromDate = hasValidDates ? rawFromDate : fallbackDate;
  const toDate = hasValidDates ? rawToDate : fallbackDate;
  const workflowId = normalizeUuid(params.get("workflow"));
  const packageId = normalizeUuid(params.get("package"));
  const pn = normalizePrescriptionNumber(params.get("pn"));
  const popup = pn && Boolean(workflowId) !== Boolean(packageId)
    ? workflowId
      ? { kind: "workflow" as const, id: workflowId, pn }
      : { kind: "package" as const, id: packageId!, pn }
    : null;
  const knownKeys = new Set(["tab", "from", "to", "workflow", "package", "pn"]);
  const hasUnknownKeys = Array.from(params.keys()).some((key) => !knownKeys.has(key));
  const hasInvalidPopup = params.has("workflow") || params.has("package") || params.has("pn")
    ? popup === null
    : false;

  return {
    tab,
    fromDate,
    toDate,
    popup,
    needsCleanup:
      hasUnknownKeys
      || (rawTab !== null && !verifyTabs.has(rawTab as QueueStage))
      || !hasValidDates
      || hasInvalidPopup,
  };
}

export function buildWorkspaceHref({
  screen,
  tab = "verify",
  fromDate,
  toDate,
  popup = null,
}: {
  screen: WorkspaceScreen;
  tab?: QueueStage;
  fromDate: string;
  toDate: string;
  popup?: WorkspacePopupTarget | null;
}) {
  const params = new URLSearchParams();
  if (screen === "verify") params.set("tab", verifyTabs.has(tab) ? tab : "verify");
  params.set("from", fromDate);
  params.set("to", toDate);
  if (screen === "verify" && popup) {
    params.set(popup.kind, popup.id);
    params.set("pn", popup.pn);
  }
  return `${workspacePathByScreen[screen]}?${params.toString()}`;
}

export function popupCloseMode(openedByApp: boolean): "back" | "replace" {
  return openedByApp ? "back" : "replace";
}

function normalizeUuid(value: string | null) {
  const normalized = value?.trim() ?? "";
  return uuidPattern.test(normalized) ? normalized.toLowerCase() : null;
}

function normalizePrescriptionNumber(value: string | null) {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 && normalized.length <= 16 ? normalized : null;
}

function isIsoDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
