"use client";

import { X } from "lucide-react";
import { type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { getPatientProfile } from "@/lib/patient-profile-api";
import type { PatientProfile, PatientQueueItem } from "@/types/pharmacy";

export function PatientProfilePopup({ patient, onClose }: { patient: PatientQueueItem; onClose: () => void }) {
  const { data: profile, isLoading } = useQuery({
    queryKey: ["patient-profile", patient.id],
    queryFn: () => getPatientProfile(patient),
  });

  return (
    <aside className="fixed inset-2 z-10 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20 sm:inset-3 xl:static xl:h-full xl:w-[520px] xl:shrink-0">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white p-5">
        <div>
          <h2 className="text-xl font-black text-slate-950">Subjective</h2>
          <p className="mt-1 text-sm font-bold text-slate-400">ข้อมูลจาก clinical note service</p>
        </div>
        <Button onClick={onClose} size="icon" variant="ghost">
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="space-y-6 p-5">
        {isLoading || !profile ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-500">กำลังโหลดข้อมูล Subjective...</div>
        ) : (
          <PatientProfileContent profile={profile} />
        )}
      </div>
    </aside>
  );
}

function PatientProfileContent({ profile }: { profile: PatientProfile }) {
  return (
    <>
      <div
        aria-label="ข้อความ Subjective แบบอ่านอย่างเดียว"
        aria-readonly="true"
        className="h-[clamp(320px,48vh,460px)] overflow-y-auto whitespace-pre-line rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm font-semibold leading-7 text-slate-700 shadow-inner outline-none focus-visible:border-blue-400 focus-visible:ring-4 focus-visible:ring-blue-100"
        role="textbox"
        tabIndex={0}
      >
        {profile.subjective}
      </div>

      <ProfileSection title="Medical Reconcile">
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black text-slate-500">
              <tr>
                {["ชื่อยา", "จำนวน", "วิธีกิน", "วันที่จ่าย"].map((heading) => (
                  <th className="px-3 py-3" key={heading}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {profile.reconcile.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-3 font-bold text-slate-800">{item.drugName}</td>
                  <td className="px-3 py-3 text-slate-600">{item.quantity}</td>
                  <td className="px-3 py-3 text-slate-600">{item.instruction}</td>
                  <td className="px-3 py-3 font-mono text-slate-600">{item.dispenseDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ProfileSection>
    </>
  );
}

function ProfileSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 border-l-4 border-blue-600 pl-3 text-sm font-black uppercase tracking-[0.06em] text-blue-700">{title}</h3>
      {children}
    </section>
  );
}
