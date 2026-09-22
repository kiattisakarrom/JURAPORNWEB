"use client";

import { BadgeCheck, BellRing, CreditCard, Megaphone, Printer, Volume2, ArrowRightLeft, LogOut, ShieldAlert, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
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
  { id: "station", label: "ช่องของฉัน" },
  { id: "assist", label: "ช่วยงานช่องอื่น" },
  { id: "history", label: "จ่ายยาเสร็จแล้ว" },
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
  const [claim, setClaim] = useState<Claim | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [channels, setChannels] = useState<DispensingChannel[]>([]);
  const [items, setItems] = useState<DispensingQueueItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
              if (!syncErrorShown.current) toast.error(reloadError instanceof Error ? reloadError.message : "โหลดคิวจ่ายยาไม่สำเร็จ");
              syncErrorShown.current = true;
            }
          } else {
            if (!syncErrorShown.current) toast.error(error instanceof Error ? error.message : "โหลดคิวจ่ายยาไม่สำเร็จ");
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
        toast.error(`ช่องจ่ายยา ${current.channel} ถูกปลดแล้ว กรุณาเลือกช่องใหม่`);
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
      .catch(() => { saveClaim(null); claimRef.current = null; toast.error("ไม่สามารถกลับเข้าช่องจ่ายยาเดิมได้ กรุณาเลือกช่องใหม่"); })
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
      .catch(error => { if (!cancelled) toast.error(error instanceof Error ? error.message : "โหลดประวัติไม่สำเร็จ"); });
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
    if (!connected) { toast.error("ขาดการเชื่อมต่อ กรุณารอให้ระบบกลับมาออนไลน์"); return; }
    setBusy(true);
    try {
      const next = { channel, token: createClientUuid() };
      await claimDispensingChannel(channel, next.token);
      saveClaim(next); claimRef.current = next; setClaim(next);
      await refreshQueue(true);
      toast.success(`เข้าช่องจ่ายยา ${channel} แล้ว`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "จองช่องไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  async function releaseChannel() {
    if (!claim) return;
    setBusy(true);
    try {
      await releaseDispensingChannel(claim.channel, claim.token);
      saveClaim(null); claimRef.current = null; setClaim(null); setSelectedId(null);
      await refreshQueue(true);
      toast.success(`ปล่อยช่องจ่ายยา ${claim.channel} แล้ว`);
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 409) {
        saveClaim(null); claimRef.current = null; setClaim(null); setSelectedId(null);
        toast.info("ช่องนี้ไม่ได้ถูกถือครองโดยแท็บนี้แล้ว");
      } else toast.error(error instanceof Error ? error.message : "ปล่อยช่องไม่สำเร็จ");
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
      toast.error("กรุณากรอกชื่อผู้ใช้ รหัสผ่าน และเหตุผลให้ครบ");
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
      toast.success(`ปลดช่องจ่ายยา ${releasedChannel} แล้ว`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ปลดช่องไม่สำเร็จ");
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
    toast.error("สิทธิ์ถือช่องจ่ายยาสิ้นสุดแล้ว กรุณาเลือกช่องใหม่");
    return true;
  }

  async function runStatus(item: DispensingQueueItem, status: "CALLED_WAITING" | "MISSED_CALL" | "RECEIVED") {
    if (!claim || !connected) { toast.error("ต้องถือครองช่องและเชื่อมต่อระบบก่อน"); return; }
    if (item.DISPENSING_CHANNEL !== claim.channel || !item.QUEUE_READY_AT) return;
    const anotherActiveCall = items.find(candidate => candidate.DISPENSING_CHANNEL === claim.channel
      && candidate.PACKAGE_ID !== item.PACKAGE_ID
      && candidate.PAGE_NOW === "DISPENSING"
      && Boolean(candidate.QUEUE_READY_AT)
      && candidate.DISPENSING_PICKUP_STATUS === "CALLED_WAITING");
    if (status === "CALLED_WAITING" && anotherActiveCall) {
      toast.error(`กำลังเรียก VN ${anotherActiveCall.VISITNUMBER} กรุณาจ่ายยาหรือกด Missed-call ก่อน`);
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
      toast.success(status === "RECEIVED" ? "ผู้ป่วยรับยาแล้ว" : status === "MISSED_CALL" ? "บันทึก Missed-call แล้ว" : "เรียกผู้ป่วยแล้ว");
    } catch (error) {
      if (!handleLostChannel(error)) toast.error(error instanceof Error ? error.message : "บันทึกสถานะไม่สำเร็จ");
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
      toast.success(`ย้าย VN ${item.VISITNUMBER} มาช่อง ${claim.channel} แล้ว`);
    } catch (error) {
      if (!handleLostChannel(error)) toast.error(error instanceof Error ? error.message : "ย้ายช่องไม่สำเร็จ");
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
  const others = items.filter(item => item.DISPENSING_CHANNEL !== claim?.channel && matches(item)).sort(readyOrder);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f7f9fc]">
      <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-200 bg-white px-4 md:px-6" aria-label="หน้าจ่ายยา">
        {tabs.map(choice => <button type="button" key={choice.id} onClick={() => onTabChange(choice.id)}
          className={cn("relative h-[54px] shrink-0 px-4 text-sm font-semibold text-slate-500 hover:text-blue-600", tab === choice.id && "text-blue-600")}>
          {choice.label}{tab === choice.id ? <span className="absolute bottom-0 left-2 right-2 h-[3px] rounded-t bg-blue-600" /> : null}
        </button>)}
      </nav>

      {!claim ? (
        <section className="min-h-0 flex-1 overflow-y-auto p-4 md:p-8">
          <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
            <h1 className="text-2xl font-black text-slate-900">เลือกช่องจ่ายยาก่อนเริ่มงาน</h1>
            <p className="mt-2 text-sm text-slate-500">แต่ละช่องใช้ได้ทีละหนึ่งเครื่อง กรุณากดปล่อยช่องเมื่อเลิกใช้งาน</p>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 8 }, (_, index) => index + 1).map(channel => {
                const occupied = channels.find(value => value.CHANNEL_NO === channel)?.OCCUPIED;
                return <div key={channel} className={cn("rounded-2xl border p-4 transition", occupied ? "border-slate-200 bg-slate-100" : "border-blue-200 bg-blue-50")}>
                  <button type="button" disabled={busy || restoring || loading || occupied || !connected}
                    onClick={() => void selectChannel(channel)} className="w-full text-left text-blue-800 disabled:cursor-not-allowed disabled:text-slate-400">
                    <div className="font-mono text-3xl font-black">{channel}</div>
                    <div className="mt-1 text-xs font-bold">{occupied ? "มีผู้ใช้งาน" : "ว่าง"}</div>
                  </button>
                  {occupied ? <button type="button" disabled={busy || !connected} onClick={() => setReleaseTarget(channel)}
                    className="mt-3 inline-flex h-8 w-full items-center justify-center gap-1 rounded-lg border border-red-200 bg-white text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50">
                    <ShieldAlert className="h-3.5 w-3.5" />ปลดช่อง
                  </button> : null}
                </div>;
              })}
            </div>
            {!connected ? <p className="mt-4 text-sm text-amber-700">ขาดการเชื่อมต่อ — ยังเลือกช่องไม่ได้</p> : null}
          </div>
        </section>
      ) : (
        <>
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 md:px-6">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-slate-950 px-4 py-2 text-white"><span className="text-xs text-slate-300">ช่องจ่ายยา</span><strong className="ml-3 font-mono text-xl">{claim.channel}</strong></div>
              <span className="text-sm font-semibold text-slate-500">คิวใช้หมายเลข VN · เรียงตามเวลาที่พร้อมทั้งยาและการเงิน</span>
            </div>
            <Button variant="outline" disabled={busy || !connected} onClick={() => void releaseChannel()}><LogOut className="h-4 w-4" />ปลดช่อง</Button>
          </div>

          {tab === "station" ? (
            <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[340px_minmax(0,1fr)]">
              <aside className="min-h-0 overflow-y-auto border-b border-slate-200 bg-white p-3 md:border-b-0 md:border-r md:p-4">
                {loading ? <p className="p-3 text-sm text-slate-500">กำลังโหลดคิว...</p> : null}
                <QueueGroup title="พร้อมเรียก" count={ready.length} items={ready} selectedId={selectedId} onSelect={setSelectedId} />
                <QueueGroup title="รอการเงิน/ประกัน" count={waiting.length} items={waiting} selectedId={selectedId} onSelect={setSelectedId} />
                <QueueGroup title="Missed-call" count={missed.length} items={missed} selectedId={selectedId} onSelect={setSelectedId} />
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
              <div className="grid gap-3 sm:grid-cols-4 xl:grid-cols-8">
                {Array.from({ length: 8 }, (_, index) => index + 1).map(channel => {
                  const occupied = channels.find(item => item.CHANNEL_NO === channel)?.OCCUPIED;
                  return <div key={channel} className={cn("rounded-2xl border border-slate-200 bg-white p-4", channel === claim.channel && "border-blue-300 bg-blue-50")}>
                    <div className="text-sm font-bold text-slate-500">ช่อง {channel}</div>
                    <div className="mt-1 font-mono text-2xl font-black text-slate-900">{items.filter(item => item.DISPENSING_CHANNEL === channel).length}</div>
                    <div className="text-xs text-slate-500">{occupied ? "มีผู้ใช้งาน" : "ยังไม่มีผู้ถือช่อง"}</div>
                    {occupied && channel !== claim.channel ? <button type="button" disabled={busy || !connected} onClick={() => setReleaseTarget(channel)}
                      className="mt-3 text-xs font-bold text-red-600 hover:underline disabled:opacity-50">ปลดช่อง</button> : null}
                  </div>;
                })}
              </div>
              <h2 className="mt-6 text-lg font-black text-slate-900">งานในช่องอื่น</h2>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {others.map(item => <div key={item.PACKAGE_ID} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <div><div className="font-mono text-lg font-black">VN {item.VISITNUMBER}</div>
                    <div className="text-sm font-semibold text-slate-700">{item.PATIENT_NAME || "ไม่พบชื่อผู้ป่วย"}</div>
                    <div className="mt-1 text-xs text-slate-500">ช่อง {item.DISPENSING_CHANNEL} · {formatTime(item.QUEUE_READY_AT)}</div></div>
                  <div className="flex items-center gap-2"><Badge className={statusClass(item)}>{statusLabel(item)}</Badge>
                    <Button variant="outline" disabled={busy || !connected || ![null, "WAITING_CALL", "MISSED_CALL"].includes(item.DISPENSING_PICKUP_STATUS)}
                      onClick={() => void pullToMyChannel(item)}><ArrowRightLeft className="h-4 w-4" />ดึงมาช่อง {claim.channel}</Button></div>
                </div>)}
              </div>
              {!others.length ? <p className="mt-5 text-sm text-slate-500">ไม่มีงานในช่องอื่น</p> : null}
            </section>
          ) : (
            <section className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
              <h2 className="text-lg font-black text-slate-900">จ่ายยาเสร็จแล้ว · {fromDate} ถึง {toDate}</h2>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {history.filter(matches).map(item => <button type="button" key={item.PACKAGE_ID} onClick={() => setSelectedId(item.PACKAGE_ID)}
                  className="rounded-2xl border border-slate-200 bg-white p-4 text-left hover:border-blue-300">
                  <div className="flex items-center justify-between"><strong className="font-mono text-lg">VN {item.VISITNUMBER}</strong><Badge className="bg-emerald-50 text-emerald-700">รับยาแล้ว</Badge></div>
                  <div className="mt-1 text-sm font-semibold">{item.PATIENT_NAME || "ไม่พบชื่อผู้ป่วย"}</div>
                  <div className="mt-1 text-xs text-slate-500">ช่อง {item.DISPENSING_CHANNEL} · {formatTime(item.RECEIVED_AT)} · เรียก {item.CALL_COUNT} ครั้ง</div>
                </button>)}
              </div>
              {!history.length ? <p className="mt-5 text-sm text-slate-500">ไม่พบประวัติในช่วงวันที่เลือก</p> : null}
              <div className="mt-5 flex gap-2"><Button variant="outline" disabled={historyPage <= 1} onClick={() => setHistoryPage(page => page - 1)}>ก่อนหน้า</Button>
                <span className="self-center text-sm text-slate-500">หน้า {historyPage}</span>
                <Button variant="outline" disabled={!historyHasMore} onClick={() => setHistoryPage(page => page + 1)}>ถัดไป</Button></div>
              {selected?.PAGE_NOW === "COMPLETE" ? <div className="mt-5"><PatientDetails item={selected} detail={detail?.PACKAGE_ID === selected.PACKAGE_ID ? detail : null} busy={false} connected={connected} activeCallVn={null} readOnly onStatus={() => undefined} /></div> : null}
            </section>
          )}
        </>
      )}
      {releaseTarget ? <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4" role="dialog" aria-modal="true" aria-labelledby="force-release-title">
        <form onSubmit={forceReleaseChannel} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div><h2 id="force-release-title" className="text-xl font-black text-slate-950">ปลดช่องจ่ายยา {releaseTarget}</h2>
              <p className="mt-1 text-sm text-slate-500">ใช้เฉพาะเมื่อยืนยันแล้วว่าเครื่องเดิมไม่ได้ใช้งานช่องนี้</p></div>
            <button type="button" aria-label="ปิด" disabled={busy} onClick={closeForceRelease} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
          </div>
          <div className="mt-5 space-y-4">
            <label className="block text-sm font-bold text-slate-700">ชื่อผู้ใช้ผู้ดูแล<Input className="mt-1" value={adminUsername} onChange={event => setAdminUsername(event.target.value)} autoComplete="username" maxLength={30} /></label>
            <label className="block text-sm font-bold text-slate-700">รหัสผ่าน<Input className="mt-1" type="password" value={adminPassword} onChange={event => setAdminPassword(event.target.value)} autoComplete="current-password" maxLength={100} /></label>
            <label className="block text-sm font-bold text-slate-700">เหตุผลที่ปลดช่อง<Input className="mt-1" value={releaseReason} onChange={event => setReleaseReason(event.target.value)} placeholder="เช่น เครื่องเดิมดับและตรวจสอบแล้ว" maxLength={120} /></label>
          </div>
          <div className="mt-6 flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={closeForceRelease}>ยกเลิก</Button>
            <Button type="submit" disabled={busy || !connected} className="bg-red-600 hover:bg-red-700"><ShieldAlert className="h-4 w-4" />ปลดช่อง</Button></div>
        </form>
      </div> : null}
    </div>
  );
}

function QueueGroup({ title, count, items, selectedId, onSelect }: {
  title: string; count: number; items: DispensingQueueItem[]; selectedId: string | null; onSelect: (id: string) => void;
}) {
  return <div className="mb-5"><div className="mb-2 flex items-center gap-2 px-1 text-sm font-black text-slate-700">{title}<Badge className="bg-blue-50 text-blue-700">{count}</Badge></div>
    <div className="space-y-2">{items.map(item => <button type="button" key={item.PACKAGE_ID} onClick={() => onSelect(item.PACKAGE_ID)}
      className={cn("w-full rounded-2xl border p-4 text-left transition", selectedId === item.PACKAGE_ID ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white hover:border-blue-200")}>
      <div className="flex items-center justify-between gap-2"><span className="font-mono text-lg font-black">VN {item.VISITNUMBER}</span><Badge className={statusClass(item)}>{statusLabel(item)}</Badge></div>
      <div className="mt-1 truncate font-semibold text-slate-700">{item.PATIENT_NAME || "ไม่พบชื่อผู้ป่วย"}</div>
      <div className="mt-1 text-xs text-slate-500">{item.ITEM_COUNT} รายการยา · พร้อม {formatTime(item.QUEUE_READY_AT)}</div>
    </button>)}</div>
  </div>;
}

function PatientDetails({ item, detail, busy, connected, onStatus, activeCallVn, readOnly = false }: {
  item: DispensingQueueItem; detail: MedicationPackage | null; busy: boolean; connected: boolean;
  onStatus: (status: "CALLED_WAITING" | "MISSED_CALL" | "RECEIVED") => void; activeCallVn: string | null; readOnly?: boolean;
}) {
  const ready = Boolean(item.QUEUE_READY_AT && item.PAGE_NOW === "DISPENSING");
  const canCall = ready
    && !activeCallVn
    && ["WAITING_CALL", "MISSED_CALL", "CALLED_WAITING"].includes(item.DISPENSING_PICKUP_STATUS ?? "");
  const isRecall = item.DISPENSING_PICKUP_STATUS === "MISSED_CALL" || item.DISPENSING_PICKUP_STATUS === "CALLED_WAITING";
  return <div className="space-y-4">
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><div className="flex items-center gap-2"><h2 className="text-2xl font-black text-slate-950">{item.PATIENT_NAME || "ไม่พบชื่อผู้ป่วย"}</h2><Badge className={statusClass(item)}>{statusLabel(item)}</Badge></div>
          <div className="mt-2 text-sm text-slate-500">VN {item.VISITNUMBER} · HN {item.PATIENTID || "—"} · วันที่ {item.VISITDATETIME}</div></div>
        <div className="font-mono text-lg font-black text-blue-700">คิว {item.VISITNUMBER} · ช่อง {item.DISPENSING_CHANNEL}</div>
      </div>
      <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-900"><strong>บันทึก / NOTE</strong><p className="mt-1 whitespace-pre-wrap">{item.VERIFY_NOTE?.trim() || "—"}</p></div>
      <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-3"><div>พร้อมรับยา: {formatTime(item.QUEUE_READY_AT)}</div><div>เรียกแล้ว: {item.CALL_COUNT} ครั้ง</div><div>รายการยา: {item.ITEM_COUNT}</div></div>
      {!ready && !readOnly ? <div role="status" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">รอการเงิน/ประกันยืนยันพร้อมรับยา (step_id 04) — ยังเรียกผู้ป่วยไม่ได้</div> : null}
      {ready && activeCallVn && !readOnly ? <div role="status" className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm font-bold text-blue-800">
        ช่องนี้กำลังเรียก VN {activeCallVn} กรุณาจ่ายยาหรือกด Missed-call ก่อนเรียกคิวถัดไป
      </div> : null}
      {ready && item.DISPENSING_PICKUP_STATUS === "MISSED_CALL" && !activeCallVn && !readOnly ? <div role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">
        คิวนี้เป็น Missed-call และสามารถเรียกผู้ป่วยอีกครั้งได้
      </div> : null}
      <div className="mt-4 flex flex-wrap gap-2"><Button disabled variant="outline"><CreditCard className="h-4 w-4" />เสียบบัตรประชาชน</Button><Button disabled variant="outline">สแกน barcode ใบนำทาง</Button></div>
    </div>
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-black text-slate-900">รายการยา ({item.ITEM_COUNT})</h3>
      <div className="mt-3 space-y-2">{detail?.ITEMS.map(drug => <div key={drug.PACKAGE_ITEM_ID} className="rounded-xl border border-slate-100 px-3 py-2">
        <div className="font-bold text-slate-800">{drug.COMMERCIALNAME || drug.MEDICINECODE}</div><div className="whitespace-pre-wrap text-xs text-slate-500">{drug.DOSEMEMO_TH || "—"}</div>
      </div>) ?? <p className="text-sm text-slate-400">กำลังโหลดรายการยา...</p>}</div>
    </div>
    {!readOnly ? <div className="flex flex-wrap gap-2 pb-3">
      <Button disabled variant="outline"><Printer className="h-4 w-4" />พิมพ์ใบ NED / MR</Button><span className="flex-1" />
      <Button variant="outline" disabled={busy || !connected || item.DISPENSING_PICKUP_STATUS !== "CALLED_WAITING"} onClick={() => onStatus("MISSED_CALL")}><Megaphone className="h-4 w-4" />Missed-call</Button>
      <Button className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100" variant="outline" disabled={busy || !connected || !canCall} onClick={() => onStatus("CALLED_WAITING")}><Volume2 className="h-4 w-4" />{isRecall ? "เรียกผู้ป่วยอีกครั้ง" : "เรียกผู้ป่วย"}</Button>
      <Button className="bg-cyan-600 hover:bg-cyan-700" disabled={busy || !connected || !ready || item.DISPENSING_PICKUP_STATUS !== "CALLED_WAITING"} onClick={() => onStatus("RECEIVED")}><BadgeCheck className="h-4 w-4" />ผู้ป่วยรับยาแล้ว</Button>
    </div> : null}
  </div>;
}

function EmptySelection() {
  return <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-400"><BellRing className="h-12 w-12" /><span className="font-bold">เลือก VN จากรายการทางซ้าย</span></div>;
}
