"use client";

import { AlertTriangle, CheckCircle2, NotebookPen, RefreshCw, Save, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { savePackageNote, type MedicationPackage } from "@/lib/package-workflow-api";
import { cn } from "@/lib/utils";

type NoteSaveStatus = "idle" | "saving" | "saved" | "waiting" | "error";

export function PackageNoteModal({
  itemPackage,
  connected,
  onClose,
  onSaved,
}: {
  itemPackage: MedicationPackage;
  connected: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const initialNote = itemPackage.VERIFY_NOTE ?? "";
  const [note, setNote] = useState(initialNote);
  const [saveStatus, setSaveStatus] = useState<NoteSaveStatus>(initialNote ? "saved" : "idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const noteRef = useRef(initialNote);
  const lastSavedNoteRef = useRef(initialNote);
  const dirtyRef = useRef(false);
  const debounceRef = useRef<number | null>(null);
  const saveLoopRef = useRef<Promise<boolean> | null>(null);
  const saveRequestedRef = useRef(false);
  const mountedRef = useRef(true);
  const connectedRef = useRef(connected);
  const onSavedRef = useRef(onSaved);

  useEffect(() => {
    connectedRef.current = connected;
    onSavedRef.current = onSaved;
  }, [connected, onSaved]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (dirtyRef.current || saveLoopRef.current) return;
    const incomingNote = itemPackage.VERIFY_NOTE ?? "";
    lastSavedNoteRef.current = incomingNote;
    noteRef.current = incomingNote;
    dirtyRef.current = false;
    setIsDirty(false);
    setNote(incomingNote);
    setSaveStatus(incomingNote ? "saved" : "idle");
  }, [itemPackage.VERIFY_NOTE]);

  const runSaveLoop = useCallback((): Promise<boolean> => {
    saveRequestedRef.current = true;
    if (saveLoopRef.current) return saveLoopRef.current;

    const loop = async () => {
      while (saveRequestedRef.current) {
        saveRequestedRef.current = false;
        if (!dirtyRef.current) continue;
        if (!connectedRef.current) {
          if (mountedRef.current) {
            setSaveStatus("waiting");
            setSaveError("ขาดการเชื่อมต่อ — รอบันทึกอัตโนมัติ");
          }
          return false;
        }

        const valueToSave = noteRef.current;
        if (mountedRef.current) {
          setSaveStatus("saving");
          setSaveError(null);
        }
        try {
          const saved = await savePackageNote(itemPackage.PACKAGE_ID, {
            note: valueToSave,
            actorName: "Pharmacist",
          });
          const savedNote = saved.VERIFY_NOTE ?? "";
          lastSavedNoteRef.current = savedNote;
          if (noteRef.current === valueToSave) {
            dirtyRef.current = noteRef.current !== savedNote;
            if (mountedRef.current) setIsDirty(dirtyRef.current);
            if (mountedRef.current) setSaveStatus(dirtyRef.current ? "idle" : "saved");
          } else {
            dirtyRef.current = true;
            if (mountedRef.current) setIsDirty(true);
            saveRequestedRef.current = true;
          }
          await onSavedRef.current().catch(() => undefined);
        } catch (error) {
          if (mountedRef.current) {
            const waiting = !navigator.onLine || !connectedRef.current;
            setSaveStatus(waiting ? "waiting" : "error");
            setSaveError(waiting
              ? "ขาดการเชื่อมต่อ — รอบันทึกอัตโนมัติ"
              : error instanceof Error ? error.message : "บันทึก NOTE ไม่สำเร็จ");
          }
          return false;
        }
      }
      return !dirtyRef.current;
    };

    const promise = loop().finally(() => {
      saveLoopRef.current = null;
    });
    saveLoopRef.current = promise;
    return promise;
  }, [itemPackage.PACKAGE_ID]);

  useEffect(() => {
    if (connected && dirtyRef.current) void runSaveLoop();
  }, [connected, runSaveLoop]);

  function scheduleSave() {
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
      void runSaveLoop();
    }, 800);
  }

  function changeNote(value: string) {
    noteRef.current = value;
    dirtyRef.current = value !== lastSavedNoteRef.current;
    setIsDirty(dirtyRef.current);
    setNote(value);
    setSaveError(null);
    setSaveStatus(dirtyRef.current ? "idle" : "saved");
    if (dirtyRef.current) scheduleSave();
    else if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }

  async function flushNote() {
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (!dirtyRef.current && !saveLoopRef.current) return true;
    return runSaveLoop();
  }

  async function requestClose() {
    setIsClosing(true);
    const saved = await flushNote();
    if (!mountedRef.current) return;
    setIsClosing(false);
    if (saved) onClose();
    else setShowDiscardConfirm(true);
  }

  return createPortal(
    <div aria-modal="true" className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0f1f3d]/45 p-4" role="dialog" aria-labelledby="package-note-title">
      <section className="w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,31,61,0.35)]">
        <header className="flex items-start gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <NotebookPen className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-black text-slate-950" id="package-note-title">บันทึก / NOTE ถึงจุด Dispensing</h2>
            <p className="mt-1 text-sm font-bold text-slate-500">
              VN {itemPackage.VISITNUMBER} · {itemPackage.PAGE_NOW === "MATCHING" ? "Matching" : "Checking"}
            </p>
          </div>
          <Button aria-label="ปิด NOTE" className="h-10 w-10 rounded-xl" disabled={isClosing} onClick={() => void requestClose()} size="icon" variant="outline">
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="p-5 sm:p-6">
          <label className="text-sm font-black text-slate-700" htmlFor="package-dispensing-note">ข้อความบันทึก</label>
          <textarea
            className="mt-2 min-h-52 w-full resize-y rounded-2xl border border-slate-300 bg-white p-4 text-sm font-semibold leading-7 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            id="package-dispensing-note"
            maxLength={1000}
            onBlur={() => void flushNote()}
            onChange={(event) => changeNote(event.target.value)}
            placeholder="ระบุ NOTE ที่ต้องการส่งต่อไปจนถึงจุด Dispensing"
            value={note}
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <PackageNoteSaveIndicator error={saveError} status={saveStatus} />
            <span className={cn("text-xs font-bold", note.length >= 950 ? "text-amber-600" : "text-slate-400")}>{note.length}/1,000</span>
          </div>
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <Button className="h-11 rounded-xl" disabled={isClosing} onClick={() => void requestClose()} variant="outline">ปิด</Button>
          <Button className="h-11 rounded-xl bg-blue-600 text-white hover:bg-blue-700" disabled={!isDirty || saveStatus === "saving" || !connected} onClick={() => void flushNote()}>
            <Save className="h-4 w-4" />
            บันทึกตอนนี้
          </Button>
        </footer>
      </section>

      {showDiscardConfirm ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#0f1f3d]/45 p-4" role="alertdialog" aria-modal="true" aria-labelledby="discard-package-note-title">
          <section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-[0_24px_60px_rgba(15,31,61,0.32)]">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-1 h-6 w-6 shrink-0 text-amber-600" />
              <div>
                <h3 className="text-lg font-black text-slate-900" id="discard-package-note-title">NOTE ยังไม่ได้บันทึก</h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">ข้อความล่าสุดยังส่งไปยังระบบไม่สำเร็จ ต้องการรอบันทึกต่อ หรือปิดและทิ้งข้อความล่าสุด?</p>
              </div>
            </div>
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              <Button className="h-11 rounded-xl" onClick={() => {
                setShowDiscardConfirm(false);
                if (connectedRef.current) void runSaveLoop();
              }} variant="outline">รอบันทึกต่อ</Button>
              <Button className="h-11 rounded-xl bg-rose-600 text-white hover:bg-rose-700" onClick={() => {
                dirtyRef.current = false;
                setIsDirty(false);
                saveRequestedRef.current = false;
                setShowDiscardConfirm(false);
                onClose();
              }}>ปิดโดยไม่บันทึก</Button>
            </div>
          </section>
        </div>
      ) : null}
    </div>,
    document.body,
  );
}

function PackageNoteSaveIndicator({ error, status }: { error: string | null; status: NoteSaveStatus }) {
  if (status === "saving") return <span className="inline-flex items-center gap-1.5 text-xs font-black text-blue-600"><RefreshCw className="h-3.5 w-3.5 animate-spin" />กำลังบันทึก…</span>;
  if (status === "saved") return <span className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" />บันทึกแล้ว</span>;
  if (status === "waiting") return <span className="text-xs font-black text-amber-700">{error ?? "ขาดการเชื่อมต่อ — รอบันทึกอัตโนมัติ"}</span>;
  if (status === "error") return <span className="text-xs font-black text-rose-600">{error ?? "บันทึกไม่สำเร็จ"}</span>;
  return <span className="text-xs font-bold text-slate-400">บันทึกอัตโนมัติหลังหยุดพิมพ์</span>;
}
