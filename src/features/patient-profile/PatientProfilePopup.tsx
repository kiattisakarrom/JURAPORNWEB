"use client";

import { X } from "lucide-react";
import { type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getPatientProfile } from "@/lib/patient-profile-api";
import { cn } from "@/lib/utils";
import type { PatientProfile, PatientQueueItem } from "@/types/pharmacy";

export function PatientProfilePopup({ patient, onClose }: { patient: PatientQueueItem; onClose: () => void }) {
  const { data: profile, isLoading } = useQuery({
    queryKey: ["patient-profile", patient.id],
    queryFn: () => getPatientProfile(patient),
  });

  return (
    <aside className="fixed inset-3 z-10 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20 xl:static xl:h-full xl:w-[520px] xl:shrink-0">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white p-5">
        <div>
          <h2 className="text-xl font-black text-slate-950">รายละเอียดโปรไฟล์ผู้ป่วย</h2>
          <p className="mt-1 text-sm font-bold text-slate-400">ข้อมูลจาก patient profile service</p>
        </div>
        <Button onClick={onClose} size="icon" variant="ghost">
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="space-y-6 p-5">
        {isLoading || !profile ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-500">กำลังโหลดข้อมูลโปรไฟล์ผู้ป่วย...</div>
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
      <ProfileSection title="ข้อมูลพื้นฐานผู้ป่วย">
        <div className="grid gap-3 sm:grid-cols-2">
          <ReadOnlyField label="HN" value={profile.hn} />
          <ReadOnlyField label="VN" value={profile.vn} />
          <ReadOnlyField className="sm:col-span-2" label="ชื่อ - นามสกุล" value={profile.fullName} />
          <ReadOnlyField label="อายุ" value={profile.age} />
          <ReadOnlyField label="เพศ" value={profile.sex} />
          <ReadOnlyField label="น้ำหนัก" value={profile.weight} />
          <ReadOnlyField label="ส่วนสูง" value={profile.height} />
        </div>
      </ProfileSection>

      <ProfileSection title="Clinical Station Info">
        <InfoRows
          rows={[
            ["หอผู้ป่วย (Ward)", profile.ward],
            ["แพทย์ผู้ดูแล", profile.doctor],
            ["การวินิจฉัย (Diagnosis)", profile.diagnosis],
          ]}
        />
      </ProfileSection>

      <ProfileSection title="ข้อมูลเภสัชกรรมที่สำคัญ">
        <InfoRows
          rows={[
            ["ประวัติการแพ้ยา", profile.keyHistory.allergy],
            ["โรคประจำตัว / Renal", profile.keyHistory.renal],
            ["Drug Interaction", profile.keyHistory.drugInteraction],
          ]}
          warnRows={[0, 2]}
        />
      </ProfileSection>

      <ProfileSection title="Medical Reconcile">
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
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

      <ProfileSection title="Drug Interaction (DI)">
        <div className="space-y-3">
          {profile.interactions.map((interaction) => (
            <div className="rounded-xl border border-slate-200 bg-white p-4" key={interaction.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-black text-slate-900">{interaction.pair}</div>
                  <div className="mt-2 text-sm font-semibold leading-6 text-slate-500">{interaction.recommendation}</div>
                </div>
                <Badge className="bg-orange-100 text-orange-700">{interaction.severity}</Badge>
              </div>
            </div>
          ))}
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

function ReadOnlyField({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="text-xs font-black text-slate-500">{label}</span>
      <span className="mt-1 flex min-h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700">{value}</span>
    </label>
  );
}

function InfoRows({ rows, warnRows = [] }: { rows: Array<[string, string]>; warnRows?: number[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      {rows.map(([label, value], index) => (
        <div className="grid grid-cols-[170px_1fr] border-b border-slate-100 last:border-b-0" key={label}>
          <div className="bg-slate-50 px-4 py-3 text-sm font-black text-slate-600">{label}</div>
          <div className={cn("px-4 py-3 text-sm font-bold text-slate-700", warnRows.includes(index) && "bg-orange-50 text-orange-700")}>{value}</div>
        </div>
      ))}
    </div>
  );
}
