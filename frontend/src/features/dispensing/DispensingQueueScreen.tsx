"use client";

import { LanguageSwitcher } from "@/i18n/LanguageSwitcher";

import { frontendErrorMessage, uiMessage, type TranslationKey, useTranslation } from "@/i18n";

import { BadgeCheck, BellRing, CreditCard, Megaphone, Printer, Volume2, ArrowRightLeft, LogOut, ShieldAlert, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { uiToast as toast } from "@/i18n/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError, apiGet } from "@/lib/api-client";
import { createClientUuid } from "@/lib/client-uuid";
import {
  claimDispensingChannel, forceReleaseDispensingChannel, getDispensingChanges, getDispensingHistory, getDispensingQueue,
  releaseDispensingChannel, releaseDispensingChannelOnPageClose, transferDispensingPackage, validateDispensingChannelClaim,
  type DispensingChannel, type DispensingQueueItem,
} from "@/lib/dispensing-api";
import { updatePackageDispensingStatus, type MedicationPackage } from "@/lib/package-workflow-api";
import { cn } from "@/lib/utils";
import type { DispensingTab } from "@/lib/workspace-navigation";

const claimStorageKey = "pharmauto-dispensing-channel";
const tabs: { id: DispensingTab; label: string }[] = [
  { id: "station", label: "dispensing.myStation" },
  { id: "assist", label: "dispensing.assistOtherStations" },
  { id: "history", label: "dispensing.dispensingCompleted" },
];

type Claim = { channel: number; token: string };

export function hasDispensingChannelClaim() {
  if (typeof window === "undefined") return false;
  try { return Boolean(window.sessionStorage.getItem(claimStorageKey)); } catch { return false; }
}

function readClaim(): Claim | null {
  try {
    const value = window.sessionStorage.getItem(claimStorageKey);
    if (!value) return null;
    const parsed = JSON.parse(value) as Claim;
    return Number.isInteger(parsed.channel) && parsed.channel >= 1 && parsed.channel <= 8 && typeof parsed.token === "string"
      ? parsed : null;
  } catch { return null; }
}

function saveClaim(claim: Claim | null) {
  try {
    if (claim) window.sessionStorage.setItem(claimStorageKey, JSON.stringify(claim));
    else window.sessionStorage.removeItem(claimStorageKey);
  } catch { /* A private browser session cannot restore a channel after refresh. */ }
}

function statusLabel(item: DispensingQueueItem) {
  if (item.PAGE_NOW === "COMPLETE") return "รับยาแล้ว";
  if (!item.QUEUE_READY_AT) return "รอการเงิน/ประกัน";
  if (item.DISPENSING_PICKUP_STATUS === "MISSED_CALL") return "Missed-call";
  if (item.DISPENSING_PICKUP_STATUS === "CALLED_WAITING") return "เรียกแล้ว";
  return "พร้อมเรียก";
}

function statusClass(item: DispensingQueueItem) {
  if (item.PAGE_NOW === "COMPLETE") return "bg-emerald-50 text-emerald-700";
  if (!item.QUEUE_READY_AT) return "bg-amber-50 text-amber-700";
  if (item.DISPENSING_PICKUP_STATUS === "MISSED_CALL") return "bg-red-50 text-red-700";
  if (item.DISPENSING_PICKUP_STATUS === "CALLED_WAITING") return "bg-blue-50 text-blue-700";
  return "bg-cyan-50 text-cyan-700";
}

function readyOrder(a: DispensingQueueItem, b: DispensingQueueItem) {
  return (a.QUEUE_READY_AT ?? "~").localeCompare(b.QUEUE_READY_AT ?? "~") || a.PACKAGE_ID.localeCompare(b.PACKAGE_ID);
}

function formatTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("th-TH", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok",
  }).format(date);
}

export function DispensingQueueScreen({
  search, connected, realtimeStamp, onRefresh, tab, onTabChange, fromDate, toDate,
}: {
  search: string; connected: boolean; realtimeStamp: string | null; onRefresh: () => Promise<void>;
  tab: DispensingTab; onTabChange: (tab: DispensingTab) => void; fromDate: string; toDate: string;
}) {
  const { t } = useTranslation();
  const [claim, setClaim] = useState<Claim | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [channels, setChannels] = useState<DispensingChannel[]>([]);
  const [items, setItems] = useState<DispensingQueueItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [assistChannel, setAssistChannel] = useState<number | null>(null);
  const [detail, setDetail] = useState<MedicationPackage | null>(null);
  const [history, setHistory] = useState<DispensingQueueItem[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [releaseTarget, setReleaseTarget] = useState<number | null>(null);
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [releaseReason, setReleaseReason] = useState("");
  const claimRef = useRef<Claim | null>(null);
  const validationInFlight = useRef<Promise<void> | null>(null);
  const cursor = useRef("");
  const syncInFlight = useRef<Promise<void> | null>(null);
  const syncRequested = useRef(false);
  const forceRequested = useRef(false);
  const syncErrorShown = useRef(false);

  const refreshQueue = useCallback(async (force = false) => {
    if (syncInFlight.current) {
      syncRequested.current = true;
      forceRequested.current ||= force;
      return syncInFlight.current;
    }
    const work = (async () => {
      let nextForce = force;
      do {
        syncRequested.current = false;
        try {
          const response = !nextForce && cursor.current
            ? await getDispensingChanges(cursor.current) : await getDispensingQueue();
          const replace = nextForce;
          cursor.current = response.CURSOR;
          setChannels(response.CHANNELS);
          setItems(previous => {
            if (replace || !previous.length) return response.UPSERTS;
            const next = new Map(previous.map(item => [item.PACKAGE_ID, item]));
            for (const id of response.REMOVED_IDS ?? []) next.delete(id);
            for (const item of response.UPSERTS) next.set(item.PACKAGE_ID, item);
            return Array.from(next.values());
          });
          syncErrorShown.current = false;
        } catch (error) {
          if (error instanceof ApiClientError && error.status === 409) {
            try {
              cursor.current = "";
              const response = await getDispensingQueue();
              cursor.current = response.CURSOR;
              setChannels(response.CHANNELS);
              setItems(response.UPSERTS);
              syncErrorShown.current = false;
            } catch (reloadError) {
              if (!syncErrorShown.current) toast.error(frontendErrorMessage(reloadError, uiMessage("dispensing.unableToLoadDispensingQueue")));
              syncErrorShown.current = true;
            }
          } else {
            if (!syncErrorShown.current) toast.error(frontendErrorMessage(error, uiMessage("dispensing.unableToLoadDispensingQueue")));
            syncErrorShown.current = true;
          }
        } finally { setLoading(false); }
        nextForce = forceRequested.current;
        forceRequested.current = false;
      } while (syncRequested.current);
    })();
    syncInFlight.current = work;
    try { await work; } finally { if (syncInFlight.current === work) syncInFlight.current = null; }
  }, []);

  const validateCurrentClaim = useCallback(async () => {
    const current = claimRef.current;
    if (!current || validationInFlight.current) return validationInFlight.current ?? undefined;
    const work = (async () => {
      try {
        await validateDispensingChannelClaim(current.channel, current.token);
      } catch (error) {
        if (!(error instanceof ApiClientError) || error.status !== 409) return;
        const latest = claimRef.current;
        if (!latest || latest.channel !== current.channel || latest.token !== current.token) return;
        saveClaim(null);
        claimRef.current = null;
        setClaim(null);
        setSelectedId(null);
        toast.error(uiMessage("dispensing.stationHasBeenReleasedSelectAnotherStation", { p0: current.channel }));
      }
    })();
    validationInFlight.current = work;
    try { await work; } finally { if (validationInFlight.current === work) validationInFlight.current = null; }
  }, []);

  useEffect(() => {
    void refreshQueue(true);
    const saved = readClaim();
    if (!saved) { void Promise.resolve().then(() => setRestoring(false)); return; }
    void claimDispensingChannel(saved.channel, saved.token)
      .then(() => { claimRef.current = saved; setClaim(saved); })
      .catch(() => { saveClaim(null); claimRef.current = null; toast.error(uiMessage("dispensing.unableToRestoreThePreviousStationSelect")); })
      .finally(() => setRestoring(false));
  }, [refreshQueue]);

  useEffect(() => {
    if (!realtimeStamp) return;
    void refreshQueue();
    void validateCurrentClaim();
  }, [realtimeStamp, refreshQueue, validateCurrentClaim]);
  useEffect(() => {
    const timer = window.setInterval(() => void refreshQueue(), 15_000);
    return () => window.clearInterval(timer);
  }, [refreshQueue]);
  useEffect(() => {
    const timer = window.setInterval(() => void validateCurrentClaim(), 5_000);
    return () => window.clearInterval(timer);
  }, [validateCurrentClaim]);

  useEffect(() => {
    const releaseOnPageClose = () => {
      const current = claimRef.current;
      if (!current) return;
      saveClaim(null);
      claimRef.current = null;
      releaseDispensingChannelOnPageClose(current.channel, current.token);
    };
    window.addEventListener("pagehide", releaseOnPageClose);
    return () => window.removeEventListener("pagehide", releaseOnPageClose);
  }, []);

  useEffect(() => {
    if (tab !== "history" || !claim) return;
    let cancelled = false;
    void getDispensingHistory(fromDate, toDate, historyPage)
      .then(result => { if (!cancelled) { setHistory(result.ITEMS); setHistoryHasMore(result.HAS_MORE); } })
      .catch(error => { if (!cancelled) toast.error(frontendErrorMessage(error, uiMessage("dispensing.unableToLoadHistory"))); });
    return () => { cancelled = true; };
  }, [tab, claim, fromDate, toDate, historyPage, realtimeStamp]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    void apiGet<MedicationPackage>(`/packages/${selectedId}`)
      .then(value => { if (!cancelled) setDetail(value); })
      .catch(() => { if (!cancelled) setDetail(null); });
    return () => { cancelled = true; };
  }, [selectedId, realtimeStamp]);

  async function selectChannel(channel: number) {
    if (!connected) { toast.error(uiMessage("dispensing.disconnectedWaitForTheSystemToReconnect")); return; }
    setBusy(true);
    try {
      const next = { channel, token: createClientUuid() };
      await claimDispensingChannel(channel, next.token);
      saveClaim(next); claimRef.current = next; setClaim(next);
      await refreshQueue(true);
      toast.success(uiMessage("dispensing.joinedDispensingStation", { p0: channel }));
    } catch (error) { toast.error(frontendErrorMessage(error, uiMessage("dispensing.unableToReserveStation"))); }
    finally { setBusy(false); }
  }

  async function releaseChannel() {
    if (!claim) return;
    setBusy(true);
    try {
      await releaseDispensingChannel(claim.channel, claim.token);
      saveClaim(null); claimRef.current = null; setClaim(null); setSelectedId(null);
      await refreshQueue(true);
      toast.success(uiMessage("dispensing.releasedDispensingStation", { p0: claim.channel }));
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 409) {
        saveClaim(null); claimRef.current = null; setClaim(null); setSelectedId(null);
        toast.info(uiMessage("dispensing.thisTabNoLongerHoldsThisStation"));
      } else toast.error(frontendErrorMessage(error, uiMessage("dispensing.unableToReleaseStation")));
    }
    finally { setBusy(false); }
  }

  function closeForceRelease() {
    if (busy) return;
    setReleaseTarget(null);
    setAdminUsername("");
    setAdminPassword("");
    setReleaseReason("");
  }

  async function forceReleaseChannel(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!releaseTarget || !adminUsername.trim() || !adminPassword || !releaseReason.trim()) {
      toast.error(uiMessage("dispensing.enterAUsernamePasswordAndReason"));
      return;
    }
    setBusy(true);
    try {
      await forceReleaseDispensingChannel(releaseTarget, {
        username: adminUsername.trim(), password: adminPassword, reason: releaseReason.trim(),
      });
      const releasedChannel = releaseTarget;
      setReleaseTarget(null);
      setAdminUsername("");
      setAdminPassword("");
      setReleaseReason("");
      await refreshQueue(true);
      toast.success(uiMessage("dispensing.releasedDispensingStation2", { p0: releasedChannel }));
    } catch (error) {
      toast.error(frontendErrorMessage(error, uiMessage("dispensing.unableToForceReleaseStation")));
      await refreshQueue(true);
    } finally { setBusy(false); }
  }

  function handleLostChannel(error: unknown) {
    if (!(error instanceof ApiClientError)
      || error.status !== 409
      || !/ถือครองช่องนี้แล้ว|ช่องจ่ายยานี้ถูกปล่อย/.test(error.message)) return false;
    saveClaim(null);
    claimRef.current = null;
    setClaim(null);
    setSelectedId(null);
    toast.error(uiMessage("dispensing.stationAccessHasEndedSelectAnotherStation"));
    return true;
  }

  async function runStatus(item: DispensingQueueItem, status: "CALLED_WAITING" | "MISSED_CALL" | "RECEIVED") {
    if (!claim || !connected) { toast.error(uiMessage("dispensing.holdAStationAndConnectToThe")); return; }
    if (item.DISPENSING_CHANNEL !== claim.channel || !item.QUEUE_READY_AT) return;
    const anotherActiveCall = items.find(candidate => candidate.DISPENSING_CHANNEL === claim.channel
      && candidate.PACKAGE_ID !== item.PACKAGE_ID
      && candidate.PAGE_NOW === "DISPENSING"
      && Boolean(candidate.QUEUE_READY_AT)
      && candidate.DISPENSING_PICKUP_STATUS === "CALLED_WAITING");
    if (status === "CALLED_WAITING" && anotherActiveCall) {
      toast.error(uiMessage("dispensing.callingVnCompleteDispensingOrMarkMissed", { p0: anotherActiveCall.VISITNUMBER }));
      return;
    }
    setBusy(true);
    try {
      await updatePackageDispensingStatus(item.PACKAGE_ID, {
        status, claimToken: claim.token, expectedRowVersion: item.ROW_VERSION,
        actionId: createClientUuid(),
      });
      await Promise.all([refreshQueue(), onRefresh()]);
      if (status === "RECEIVED") setSelectedId(null);
      toast.success(status === "RECEIVED" ? uiMessage("dispensing.patientReceivedMedication") : status === "MISSED_CALL" ? uiMessage("dispensing.missedCallSaved") : uiMessage("dispensing.patientCalled"));
    } catch (error) {
      if (!handleLostChannel(error)) toast.error(frontendErrorMessage(error, uiMessage("dispensing.unableToSaveStatus")));
      await refreshQueue();
    } finally { setBusy(false); }
  }

  async function pullToMyChannel(item: DispensingQueueItem) {
    if (!claim || !connected) return;
    setBusy(true);
    try {
      await transferDispensingPackage(item.PACKAGE_ID, claim.channel, {
        claimToken: claim.token, expectedRowVersion: item.ROW_VERSION,
        actionId: createClientUuid(),
      });
      await Promise.all([refreshQueue(), onRefresh()]);
      toast.success(uiMessage("dispensing.movedVnToStation", { p0: item.VISITNUMBER, p1: claim.channel }));
    } catch (error) {
      if (!handleLostChannel(error)) toast.error(frontendErrorMessage(error, uiMessage("dispensing.unableToTransferStation")));
      await refreshQueue();
    } finally { setBusy(false); }
  }

  const matches = useCallback((item: DispensingQueueItem) => {
    const keyword = search.trim().toLowerCase();
    return !keyword || [item.VISITNUMBER, item.PATIENTID ?? "", item.PATIENT_NAME ?? ""].some(value => value.toLowerCase().includes(keyword));
  }, [search]);
  const mine = useMemo(() => items.filter(item => item.DISPENSING_CHANNEL === claim?.channel && matches(item)), [items, claim, matches]);
  const ready = mine.filter(item => item.QUEUE_READY_AT && item.DISPENSING_PICKUP_STATUS !== "MISSED_CALL").sort(readyOrder);
  const waiting = mine.filter(item => !item.QUEUE_READY_AT).sort((a, b) => (a.CHECKING_COMPLETED_AT ?? "").localeCompare(b.CHECKING_COMPLETED_AT ?? ""));
  const missed = mine.filter(item => item.DISPENSING_PICKUP_STATUS === "MISSED_CALL").sort(readyOrder);
  const activeCalled = mine.find(item => item.PAGE_NOW === "DISPENSING"
    && Boolean(item.QUEUE_READY_AT)
    && item.DISPENSING_PICKUP_STATUS === "CALLED_WAITING") ?? null;
  const selected = [...items, ...history].find(item => item.PACKAGE_ID === selectedId) ?? null;
  const selectedAssistChannel = assistChannel === claim?.channel ? null : assistChannel;
  const assistItems = selectedAssistChannel === null ? [] : items
    .filter(item => item.DISPENSING_CHANNEL === selectedAssistChannel && matches(item))
    .sort(readyOrder);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f7f9fc]">
      <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-200 bg-white px-4 md:px-6" aria-label={t("dispensing.dispensingPages")}>
        {tabs.map(choice => <button type="button" key={choice.id} onClick={() => onTabChange(choice.id)}
          className={cn("relative h-[54px] shrink-0 px-4 text-sm font-semibold text-slate-500 hover:text-blue-600", tab === choice.id && "text-blue-600")}>
          {t(choice.label as TranslationKey)}{tab === choice.id ? <span className="absolute bottom-0 left-2 right-2 h-[3px] rounded-t bg-blue-600" /> : null}
        </button>)}
      </nav>

      {!claim ? (
        <section className="min-h-0 flex-1 overflow-y-auto p-4 md:p-8">
          <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
            <h1 className="text-2xl font-black text-slate-900">{t("dispensing.selectADispensingStationToStart")}</h1>
            <p className="mt-2 text-sm text-slate-500">{t("dispensing.eachStationSupportsOneWorkstationAtA")}</p>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 8 }, (_, index) => index + 1).map(channel => {
                const occupied = channels.find(value => value.CHANNEL_NO === channel)?.OCCUPIED;
                return <div key={channel} className={cn("rounded-2xl border p-4 transition", occupied ? "border-slate-200 bg-slate-100" : "border-blue-200 bg-blue-50")}>
                  <button type="button" disabled={busy || restoring || loading || occupied || !connected}
                    onClick={() => void selectChannel(channel)} className="w-full text-left text-blue-800 disabled:cursor-not-allowed disabled:text-slate-400">
                    <div className="font-mono text-3xl font-black">{channel}</div>
                    <div className="mt-1 text-xs font-bold">{occupied ? t("dispensing.occupied") : t("dispensing.available")}</div>
                  </button>
                  {occupied ? <button type="button" disabled={busy || !connected} onClick={() => setReleaseTarget(channel)}
                    className="mt-3 inline-flex h-8 w-full items-center justify-center gap-1 rounded-lg border border-red-200 bg-white text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50">
                    <ShieldAlert className="h-3.5 w-3.5" />{t("dispensing.releaseStation")}</button> : null}
                </div>;
              })}
            </div>
            {!connected ? <p className="mt-4 text-sm text-amber-700">{t("dispensing.disconnectedStationSelectionUnavailable")}</p> : null}
          </div>
        </section>
      ) : (
        <>
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 md:px-6">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-slate-950 px-4 py-2 text-white"><span className="text-xs text-slate-300">{t("dispensing.dispensingStation")}</span><strong className="ml-3 font-mono text-xl">{claim.channel}</strong></div>
              <span className="text-sm font-semibold text-slate-500">{t("dispensing.queueUsesVnNumbersOrderedByMedication")}</span>
            </div>
            <Button variant="outline" disabled={busy || !connected} onClick={() => void releaseChannel()}><LogOut className="h-4 w-4" />{t("dispensing.releaseStation")}</Button>
          </div>

          {tab === "station" ? (
            <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[340px_minmax(0,1fr)]">
              <aside className="min-h-0 overflow-y-auto border-b border-slate-200 bg-white p-3 md:border-b-0 md:border-r md:p-4">
                {loading ? <p className="p-3 text-sm text-slate-500">{t("dispensing.loadingQueue")}</p> : null}
                <QueueGroup title={t("dispensing.readyToCall")} count={ready.length} items={ready} selectedId={selectedId} onSelect={setSelectedId} />
                <QueueGroup title={t("dispensing.awaitingPaymentInsurance")} count={waiting.length} items={waiting} selectedId={selectedId} onSelect={setSelectedId} />
                <QueueGroup title={t("common.missedCall")} count={missed.length} items={missed} selectedId={selectedId} onSelect={setSelectedId} />
              </aside>
              <section className="min-h-0 overflow-y-auto p-4 md:p-6">
                {selected && selected.DISPENSING_CHANNEL === claim.channel ? (
                  <PatientDetails item={selected} detail={detail?.PACKAGE_ID === selected.PACKAGE_ID ? detail : null} busy={busy} connected={connected}
                    activeCallVn={activeCalled?.PACKAGE_ID !== selected.PACKAGE_ID ? activeCalled?.VISITNUMBER ?? null : null}
                    onStatus={status => void runStatus(selected, status)} />
                ) : <EmptySelection />}
              </section>
            </div>
          ) : tab === "assist" ? (
            <section className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
              <h2 className="text-lg font-black text-slate-900">{t("dispensing.otherStations")}</h2>
              <p className="mt-1 text-sm text-slate-500">{t("dispensing.selectAStationToAssistOnlyIts")}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-4 xl:grid-cols-8">
                {Array.from({ length: 8 }, (_, index) => index + 1).map(channel => {
                  const occupied = channels.find(item => item.CHANNEL_NO === channel)?.OCCUPIED;
                  const queueCount = items.filter(item => item.DISPENSING_CHANNEL === channel).length;
                  const isOwn = channel === claim.channel;
                  const isSelected = channel === selectedAssistChannel;
                  return <div key={channel} className={cn("rounded-2xl border bg-white p-2 transition", isSelected ? "border-blue-500 bg-blue-50 shadow-sm" : "border-slate-200", isOwn && "bg-slate-100")}>
                    <button type="button" disabled={isOwn} aria-pressed={isSelected}
                      onClick={() => setAssistChannel(channel)}
                      className="w-full rounded-xl p-2 text-left transition hover:bg-blue-50 disabled:cursor-default disabled:hover:bg-transparent">
                      <div className={cn("text-sm font-bold", isSelected ? "text-blue-700" : "text-slate-500")}>{t("dispensing.station")} {channel}</div>
                      <div className="mt-1 flex items-baseline gap-1"><span className="font-mono text-2xl font-black text-slate-900">{queueCount}</span><span className="text-xs font-bold text-slate-500">{t("dispensing.waiting")}</span></div>
                      <div className="text-xs text-slate-500">{isOwn ? t("dispensing.myStation") : occupied ? t("dispensing.occupied") : t("dispensing.unclaimed")}</div>
                    </button>
                    {occupied && channel !== claim.channel ? <button type="button" disabled={busy || !connected} onClick={() => setReleaseTarget(channel)}
                      className="mt-1 w-full pb-1 text-xs font-bold text-red-600 hover:underline disabled:opacity-50">{t("dispensing.releaseStation")}</button> : null}
                  </div>;
                })}
              </div>
              {selectedAssistChannel !== null ? <div className="mt-6 flex items-center gap-2">
                <h3 className="text-lg font-black text-slate-900">{t("dispensing.stationQueue")} {selectedAssistChannel}</h3>
                <Badge className="bg-blue-50 text-blue-700">{assistItems.length}  {t("dispensing.queues")}</Badge>
              </div> : null}
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {assistItems.map(item => <div key={item.PACKAGE_ID} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <div><div className="font-mono text-lg font-black">{t("common.vn")} {item.VISITNUMBER}</div>
                    <div className="text-sm font-semibold text-slate-700">{item.PATIENT_NAME || t("dispensing.patientNameUnavailable")}</div>
                    <div className="mt-1 text-xs text-slate-500">{t("dispensing.station")} {item.DISPENSING_CHANNEL} · {formatTime(item.QUEUE_READY_AT)}</div></div>
                  <div className="flex items-center gap-2"><Badge className={statusClass(item)}>{statusLabel(item)}</Badge>
                    <Button variant="outline" disabled={busy || !connected || ![null, "WAITING_CALL", "MISSED_CALL"].includes(item.DISPENSING_PICKUP_STATUS)}
                      onClick={() => void pullToMyChannel(item)}><ArrowRightLeft className="h-4 w-4" />{t("dispensing.moveToStation")} {claim.channel}</Button></div>
                </div>)}
              </div>
              {selectedAssistChannel === null ? <p className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm font-semibold text-slate-500">{t("dispensing.selectAStationToAssistAbove")}</p> : null}
              {selectedAssistChannel !== null && !assistItems.length ? <p className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm font-semibold text-slate-500">{t("dispensing.noWaitingQueueInStation")} {selectedAssistChannel}</p> : null}
            </section>
          ) : (
            <section className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
              <h2 className="text-lg font-black text-slate-900">{t("dispensing.dispensingCompleted2")} {fromDate}  {t("dispensing.to")} {toDate}</h2>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {history.filter(matches).map(item => <button type="button" key={item.PACKAGE_ID} onClick={() => setSelectedId(item.PACKAGE_ID)}
                  className="rounded-2xl border border-slate-200 bg-white p-4 text-left hover:border-blue-300">
                  <div className="flex items-center justify-between"><strong className="font-mono text-lg">{t("common.vn")} {item.VISITNUMBER}</strong><Badge className="bg-emerald-50 text-emerald-700">{t("dispensing.received")}</Badge></div>
                  <div className="mt-1 text-sm font-semibold">{item.PATIENT_NAME || t("dispensing.patientNameUnavailable")}</div>
                  <div className="mt-1 text-xs text-slate-500">{t("dispensing.station")} {item.DISPENSING_CHANNEL} · {formatTime(item.RECEIVED_AT)}  {t("dispensing.called")} {item.CALL_COUNT}  {t("dispensing.times")}</div>
                </button>)}
              </div>
              {!history.length ? <p className="mt-5 text-sm text-slate-500">{t("dispensing.noHistoryInTheSelectedDateRange")}</p> : null}
              <div className="mt-5 flex gap-2"><Button variant="outline" disabled={historyPage <= 1} onClick={() => setHistoryPage(page => page - 1)}>{t("common.previous")}</Button>
                <span className="self-center text-sm text-slate-500">{t("common.page")} {historyPage}</span>
                <Button variant="outline" disabled={!historyHasMore} onClick={() => setHistoryPage(page => page + 1)}>{t("common.next")}</Button></div>
              {selected?.PAGE_NOW === "COMPLETE" ? <div className="mt-5"><PatientDetails item={selected} detail={detail?.PACKAGE_ID === selected.PACKAGE_ID ? detail : null} busy={false} connected={connected} activeCallVn={null} readOnly onStatus={() => undefined} /></div> : null}
            </section>
          )}
        </>
      )}
      {releaseTarget ? <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4" role="dialog" aria-modal="true" aria-labelledby="force-release-title">
        <form onSubmit={forceReleaseChannel} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
          <div className="mb-3 flex justify-end"><LanguageSwitcher /></div>
          <div className="flex items-start justify-between gap-3">
            <div><h2 id="force-release-title" className="text-xl font-black text-slate-950">{t("dispensing.releaseDispensingStation")} {releaseTarget}</h2>
              <p className="mt-1 text-sm text-slate-500">{t("dispensing.useOnlyAfterConfirmingThePreviousWorkstation")}</p></div>
            <button type="button" aria-label={t("common.close")} disabled={busy} onClick={closeForceRelease} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
          </div>
          <div className="mt-5 space-y-4">
            <label className="block text-sm font-bold text-slate-700">{t("dispensing.administratorUsername")}<Input className="mt-1" value={adminUsername} onChange={event => setAdminUsername(event.target.value)} autoComplete="username" maxLength={30} /></label>
            <label className="block text-sm font-bold text-slate-700">{t("dispensing.password")}<Input className="mt-1" type="password" value={adminPassword} onChange={event => setAdminPassword(event.target.value)} autoComplete="current-password" maxLength={100} /></label>
            <label className="block text-sm font-bold text-slate-700">{t("dispensing.releaseReason")}<Input className="mt-1" value={releaseReason} onChange={event => setReleaseReason(event.target.value)} placeholder={t("dispensing.forExampleThePreviousWorkstationIsConfirmed")} maxLength={120} /></label>
          </div>
          <div className="mt-6 flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={closeForceRelease}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={busy || !connected} className="bg-red-600 hover:bg-red-700"><ShieldAlert className="h-4 w-4" />{t("dispensing.releaseStation")}</Button></div>
        </form>
      </div> : null}
    </div>
  );
}

function QueueGroup({ title, count, items, selectedId, onSelect }: {
  title: string; count: number; items: DispensingQueueItem[]; selectedId: string | null; onSelect: (id: string) => void;
}) {
  const { t } = useTranslation();
  return <div className="mb-5"><div className="mb-2 flex items-center gap-2 px-1 text-sm font-black text-slate-700">{title}<Badge className="bg-blue-50 text-blue-700">{count}</Badge></div>
    <div className="space-y-2">{items.map(item => <button type="button" key={item.PACKAGE_ID} onClick={() => onSelect(item.PACKAGE_ID)}
      className={cn("w-full rounded-2xl border p-4 text-left transition", selectedId === item.PACKAGE_ID ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white hover:border-blue-200")}>
      <div className="flex items-center justify-between gap-2"><span className="font-mono text-lg font-black">{t("common.vn")} {item.VISITNUMBER}</span><Badge className={statusClass(item)}>{statusLabel(item)}</Badge></div>
      <div className="mt-1 truncate font-semibold text-slate-700">{item.PATIENT_NAME || t("dispensing.patientNameUnavailable")}</div>
      <div className="mt-1 text-xs text-slate-500">{item.ITEM_COUNT}  {t("dispensing.medicationsReady")} {formatTime(item.QUEUE_READY_AT)}</div>
    </button>)}</div>
  </div>;
}

function PatientDetails({ item, detail, busy, connected, onStatus, activeCallVn, readOnly = false }: {
  item: DispensingQueueItem; detail: MedicationPackage | null; busy: boolean; connected: boolean;
  onStatus: (status: "CALLED_WAITING" | "MISSED_CALL" | "RECEIVED") => void; activeCallVn: string | null; readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const ready = Boolean(item.QUEUE_READY_AT && item.PAGE_NOW === "DISPENSING");
  const canCall = ready
    && !activeCallVn
    && ["WAITING_CALL", "MISSED_CALL", "CALLED_WAITING"].includes(item.DISPENSING_PICKUP_STATUS ?? "");
  const isRecall = item.DISPENSING_PICKUP_STATUS === "MISSED_CALL" || item.DISPENSING_PICKUP_STATUS === "CALLED_WAITING";
  return <div className="space-y-4">
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><div className="flex items-center gap-2"><h2 className="text-2xl font-black text-slate-950">{item.PATIENT_NAME || t("dispensing.patientNameUnavailable")}</h2><Badge className={statusClass(item)}>{statusLabel(item)}</Badge></div>
          <div className="mt-2 text-sm text-slate-500">{t("common.vn")} {item.VISITNUMBER}  {t("dispensing.hn")} {item.PATIENTID || "—"}  {t("dispensing.date")} {item.VISITDATETIME}</div></div>
        <div className="font-mono text-lg font-black text-blue-700">{t("dispensing.queues")} {item.VISITNUMBER}  {t("dispensing.station2")} {item.DISPENSING_CHANNEL}</div>
      </div>
      <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-900"><strong>{t("common.note")}</strong><p className="mt-1 whitespace-pre-wrap">{item.VERIFY_NOTE?.trim() || "—"}</p></div>
      <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-3"><div>{t("dispensing.readyForPickup")} {formatTime(item.QUEUE_READY_AT)}</div><div>{t("dispensing.called2")} {item.CALL_COUNT}  {t("dispensing.times")}</div><div>{t("dispensing.medications")} {item.ITEM_COUNT}</div></div>
      {!ready && !readOnly ? <div role="status" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">{t("dispensing.awaitingPaymentInsuranceConfirmationStepId04")}</div> : null}
      {ready && activeCallVn && !readOnly ? <div role="status" className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm font-bold text-blue-800">
        {t("dispensing.thisStationIsCallingVn")}{activeCallVn} {t("dispensing.completeDispensingOrMarkMissedCallBefore")}</div> : null}
      {ready && item.DISPENSING_PICKUP_STATUS === "MISSED_CALL" && !activeCallVn && !readOnly ? <div role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">
        {t("dispensing.thisQueueIsMarkedMissedCallThe")}</div> : null}
      <div className="mt-4 flex flex-wrap gap-2"><Button disabled variant="outline"><CreditCard className="h-4 w-4" />{t("dispensing.insertNationalIdCard")}</Button><Button disabled variant="outline">{t("dispensing.scanGuideBarcode")}</Button></div>
    </div>
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-black text-slate-900">{t("common.medicationsHeading")}{item.ITEM_COUNT})</h3>
      <div className="mt-3 space-y-2">{detail?.ITEMS.map(drug => <div key={drug.PACKAGE_ITEM_ID} className="rounded-xl border border-slate-100 px-3 py-2">
        <div className="font-bold text-slate-800">{drug.COMMERCIALNAME || drug.MEDICINECODE}</div><div className="whitespace-pre-wrap text-xs text-slate-500">{drug.DOSEMEMO_TH || "—"}</div>
      </div>) ?? <p className="text-sm text-slate-400">{t("dispensing.loadingMedication")}</p>}</div>
    </div>
    {!readOnly ? <div className="flex flex-wrap gap-2 pb-3">
      <Button disabled variant="outline"><Printer className="h-4 w-4" />{t("dispensing.printNedMr")}</Button><span className="flex-1" />
      <Button variant="outline" disabled={busy || !connected || item.DISPENSING_PICKUP_STATUS !== "CALLED_WAITING"} onClick={() => onStatus("MISSED_CALL")}><Megaphone className="h-4 w-4" />{t("common.missedCall")}</Button>
      <Button className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100" variant="outline" disabled={busy || !connected || !canCall} onClick={() => onStatus("CALLED_WAITING")}><Volume2 className="h-4 w-4" />{isRecall ? t("dispensing.callPatientAgain") : t("dispensing.callPatient")}</Button>
      <Button className="bg-cyan-600 hover:bg-cyan-700" disabled={busy || !connected || !ready || item.DISPENSING_PICKUP_STATUS !== "CALLED_WAITING"} onClick={() => onStatus("RECEIVED")}><BadgeCheck className="h-4 w-4" />{t("dispensing.patientReceivedMedication")}</Button>
    </div> : null}
  </div>;
}

function EmptySelection() {
  const { t } = useTranslation();
  return <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-400"><BellRing className="h-12 w-12" /><span className="font-bold">{t("dispensing.selectAVnFromTheListOn")}</span></div>;
}
