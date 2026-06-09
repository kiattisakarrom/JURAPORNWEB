"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Clock3,
  Eye,
  EyeOff,
  LogOut,
  PackageCheck,
  Pill,
  Search,
  Send,
  ShieldCheck,
  Siren,
  Sparkles,
  UserPlus,
  X,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getPharmacyQueue } from "@/lib/pharmacy-api";
import { getMachineStockCheck } from "@/lib/stock-check-api";
import { cn } from "@/lib/utils";
import type { AlertKind, PatientQueueItem, Priority, QueueStage, StockCheckResponse } from "@/types/pharmacy";

const tabs: { id: QueueStage; label: string }[] = [
  { id: "all", label: "ทั้งหมด" },
  { id: "verify", label: "Verify" },
  { id: "picking", label: "Picking" },
  { id: "matching", label: "Matching" },
  { id: "checking", label: "Checking" },
  { id: "dispensing", label: "Dispensing" },
  { id: "pending", label: "Pending" },
  { id: "complete", label: "Complete" },
  { id: "missed-call", label: "Missed-call" },
];

const alertStyles: Record<AlertKind, string> = {
  duplicate: "bg-rose-100 text-rose-600",
  interaction: "bg-blue-100 text-blue-700",
  machine: "bg-orange-100 text-orange-600",
  stock: "bg-pink-100 text-pink-700",
  paper: "bg-yellow-100 text-amber-700",
  note: "bg-violet-100 text-violet-700",
};

const priorityStyles: Record<Priority, string> = {
  Stat: "text-red-500",
  "Re-work": "text-orange-500",
  New: "text-slate-400",
};

const stageStyles: Record<PatientQueueItem["stage"], string> = {
  verify: "bg-blue-100 text-blue-700",
  picking: "bg-cyan-100 text-cyan-700",
  matching: "bg-violet-100 text-violet-700",
  checking: "bg-emerald-100 text-emerald-700",
  dispensing: "bg-indigo-100 text-indigo-700",
  pending: "bg-yellow-100 text-amber-700",
  complete: "bg-slate-100 text-slate-600",
  "missed-call": "bg-rose-100 text-rose-700",
};

const stageDotStyles: Record<PatientQueueItem["stage"], string> = {
  verify: "bg-blue-500",
  picking: "bg-cyan-500",
  matching: "bg-violet-500",
  checking: "bg-emerald-500",
  dispensing: "bg-indigo-500",
  pending: "bg-amber-500",
  complete: "bg-slate-400",
  "missed-call": "bg-rose-500",
};

function stageLabel(stage: PatientQueueItem["stage"]) {
  if (stage === "missed-call") return "Missed-call";
  return stage.charAt(0).toUpperCase() + stage.slice(1);
}

function durationClass(minutes: number) {
  if (minutes <= 20) return "text-emerald-500";
  if (minutes <= 30) return "text-orange-500";
  return "text-orange-600";
}

function alertIcon(kind: AlertKind) {
  if (kind === "duplicate") return <Siren className="h-4 w-4" />;
  if (kind === "interaction") return <Pill className="h-4 w-4" />;
  if (kind === "machine") return <AlertTriangle className="h-4 w-4" />;
  if (kind === "stock") return <PackageCheck className="h-4 w-4" />;
  if (kind === "paper") return <CheckCircle2 className="h-4 w-4" />;
  return <Sparkles className="h-4 w-4" />;
}

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  function handleLogin() {
    window.localStorage.setItem("pharmauto-session", "active");
    setIsAuthenticated(true);
  }

  function handleLogout() {
    window.localStorage.removeItem("pharmauto-session");
    setIsAuthenticated(false);
  }

  return isAuthenticated ? <PharmacyDashboard onLogout={handleLogout} /> : <AuthScreen onLogin={handleLogin} />;
}

function AuthScreen({ onLogin }: { onLogin: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (mode === "register") {
      toast.info("หน้านี้เป็น mock register สำหรับเตรียม flow ก่อนเชื่อม backend");
      setMode("login");
      setUsername("1");
      setPassword("1");
      return;
    }

    if (username === "1" && password === "1") {
      toast.success("เข้าสู่ระบบสำเร็จ");
      onLogin();
      return;
    }

    toast.error("รหัสทดสอบคือ username 1 และ password 1");
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#dbeafe,transparent_32%),linear-gradient(135deg,#f8fbff_0%,#eef4fb_52%,#f7f5ff_100%)] px-4 py-6 sm:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-48px)] max-w-6xl items-center gap-8 lg:grid-cols-[1.08fr_0.92fr]">
        <section className="space-y-8">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200">
              <Activity className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-normal text-slate-950 sm:text-3xl">PharmAuto OPD</h1>
              <p className="mt-1 text-sm font-semibold text-slate-500">Hospital Pharmacy Workstation</p>
            </div>
          </div>

          <div className="max-w-2xl space-y-5">
            <Badge className="bg-white text-blue-700 shadow-sm ring-1 ring-blue-100">
              <ShieldCheck className="mr-2 h-4 w-4" />
              Frontend prototype พร้อมต่อ API
            </Badge>
            <h2 className="text-4xl font-black leading-tight tracking-normal text-slate-950 sm:text-5xl">
              ระบบคิวจ่ายยาที่อ่านง่าย เร็ว และพร้อมใช้บนทุกหน้าจอ
            </h2>
            <p className="max-w-xl text-base leading-8 text-slate-600">
              หน้านี้ใช้ข้อมูลจำลองเพื่อแสดง flow งาน Verify, alert รายการยา และสถานะผู้ป่วยตามตัวอย่าง ก่อนเชื่อมต่อ backend จริงในขั้นถัดไป
            </p>
          </div>

          <div className="grid max-w-2xl gap-3 sm:grid-cols-3">
            {[
              ["Verify Queue", "7 เคส"],
              ["Stat Alert", "2 เคส"],
              ["Pending SLA", "1 เคส"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/80 bg-white/70 p-4 shadow-sm backdrop-blur">
                <div className="text-sm font-bold text-slate-500">{label}</div>
                <div className="mt-2 text-2xl font-black text-slate-950">{value}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-white/80 bg-white/85 p-5 shadow-2xl shadow-slate-200/70 backdrop-blur sm:p-8">
          <div className="mb-6 flex rounded-2xl bg-slate-100 p-1">
            <button
              className={cn("h-11 flex-1 rounded-xl text-sm font-black transition", mode === "login" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500")}
              onClick={() => setMode("login")}
              type="button"
            >
              Login
            </button>
            <button
              className={cn("h-11 flex-1 rounded-xl text-sm font-black transition", mode === "register" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500")}
              onClick={() => setMode("register")}
              type="button"
            >
              Register
            </button>
          </div>

          <div className="mb-6">
            <h3 className="text-2xl font-black text-slate-950">{mode === "login" ? "เข้าสู่ระบบ" : "ลงทะเบียนผู้ใช้"}</h3>
            <p className="mt-2 text-sm font-medium text-slate-500">
              {mode === "login" ? "ใช้รหัสทดสอบ username 1 และ password 1" : "mock form สำหรับเตรียมหน้าตาและ flow ก่อนต่อ backend"}
            </p>
          </div>

          <form className="space-y-4" onSubmit={submit}>
            {mode === "register" ? <Input placeholder="ชื่อ-นามสกุล" /> : null}
            <Input placeholder="Username" value={username} onChange={(event) => setUsername(event.target.value)} />
            {mode === "register" ? <Input placeholder="รหัสพนักงาน / License No." /> : null}
            <div className="relative">
              <Input
                className="pr-12"
                placeholder="Password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button
                aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                onClick={() => setShowPassword((current) => !current)}
                type="button"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Button className="h-12 w-full text-base" type="submit">
              {mode === "login" ? <ShieldCheck className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
              {mode === "login" ? "เข้าสู่ Workstation" : "สร้างบัญชีทดสอบ"}
            </Button>
          </form>
        </section>
      </div>
    </main>
  );
}

function PharmacyDashboard({ onLogout }: { onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<QueueStage>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["pharmacy-queue"],
    queryFn: getPharmacyQueue,
    refetchInterval: 15000,
  });

  const patients = useMemo(() => data?.patients ?? [], [data?.patients]);
  const filteredPatients = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return patients.filter((patient) => {
      const matchesTab = activeTab === "all" || patient.stage === activeTab;
      const matchesSearch = !keyword || [patient.vn, patient.hn, patient.name].some((value) => value.toLowerCase().includes(keyword));
      return matchesTab && matchesSearch;
    });
  }, [activeTab, patients, search]);

  const selectedPatient = selectedId ? patients.find((patient) => patient.id === selectedId) : undefined;

  function selectTab(tabId: QueueStage) {
    setActiveTab(tabId);
    setSelectedId(null);
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-slate-100 text-slate-900">
      <header className="relative z-30 shrink-0 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex min-h-20 flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-100">
                <Activity className="h-7 w-7" />
              </div>
              <div>
                <div className="text-lg font-black text-slate-950">PharmAuto OPD</div>
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Verify Workstation</div>
              </div>
            </div>
            <Button className="lg:hidden" onClick={onLogout} size="icon" variant="ghost">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex gap-2">
              <Badge className="bg-blue-100 text-blue-700">7 Verify</Badge>
              <Badge className="bg-red-100 text-red-600">2 Stat</Badge>
              <Badge className="bg-yellow-100 text-amber-700">1 Pending</Badge>
            </div>
            <div className="hidden items-center gap-2 font-mono text-lg font-black tracking-[0.2em] text-slate-800 sm:flex">
              <Clock3 className="h-4 w-4 text-slate-400" />
              09:10:43
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              <span className="font-sans text-xs tracking-normal text-slate-400">LIVE</span>
            </div>
            <div className="relative min-w-0 sm:w-72">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <Input className="pl-10" placeholder="ค้นหา VN, HN, ชื่อ" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
            <Button className="hidden lg:inline-flex" onClick={onLogout} variant="ghost">
              <LogOut className="h-4 w-4" />
              ออก
            </Button>
          </div>
        </div>

        <nav className="overflow-x-auto border-t border-slate-100 bg-white px-3">
          <div className="flex min-w-max gap-1">
            {tabs.map((tab) => (
              <button
                className={cn(
                  "relative h-14 px-4 text-sm font-black text-slate-500 transition hover:text-blue-600",
                  activeTab === tab.id && "text-blue-700",
                )}
                key={tab.id}
                onClick={() => selectTab(tab.id)}
                type="button"
              >
                {tab.label}
                <span className="ml-2 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">{data?.summary[tab.id] ?? 0}</span>
                {activeTab === tab.id ? <span className="absolute bottom-0 left-2 right-2 h-1 rounded-t-full bg-blue-600" /> : null}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <div
        className="grid min-h-0 flex-1 overflow-hidden bg-white"
      >
        <section className="h-full min-h-0 overflow-hidden bg-white">
          <DesktopQueueTable isLoading={isLoading} patients={filteredPatients} selectedId={selectedPatient?.id} onClose={() => setSelectedId(null)} onSelect={setSelectedId} />
          <MobileQueueList patients={filteredPatients} selectedId={selectedPatient?.id} onSelect={setSelectedId} />
        </section>
      </div>
      {selectedPatient ? <PatientPanel patient={selectedPatient} onClose={() => setSelectedId(null)} /> : null}
    </main>
  );
}

function DesktopQueueTable({
  patients,
  selectedId,
  isLoading,
  onClose,
  onSelect,
}: {
  patients: PatientQueueItem[];
  selectedId?: string;
  isLoading: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="hidden h-full min-h-0 overflow-auto md:block">
      <table className="w-full min-w-[1100px] border-collapse text-left">
        <thead className="sticky top-0 z-20 border-b border-slate-200 bg-white text-xs font-black uppercase tracking-[0.12em] text-slate-400 shadow-[0_1px_0_#dfe7f1]">
          <tr>
            {["Priority", "VN", "HN", "ชื่อ-นามสกุล", "สถานะ", "รายการยา", "แจ้งเตือน", "เวลา", "Duration", "เภสัชกร"].map((label) => (
              <th className="h-14 px-5" key={label}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {isLoading ? (
            <tr><td className="px-5 py-8 text-sm font-bold text-slate-400" colSpan={10}>กำลังโหลดข้อมูล...</td></tr>
          ) : patients.map((patient) => (
            <tr
              className={cn("cursor-pointer transition hover:bg-blue-50/50", selectedId === patient.id && "bg-blue-50")}
              key={patient.id}
              onClick={() => onSelect(patient.id)}
            >
              <td className={cn("h-[76px] px-5 text-sm font-black", priorityStyles[patient.priority])}>
                <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-current" />
                {patient.priority}
              </td>
              <td className="px-5 font-black text-slate-600">{patient.vn}</td>
              <td className="px-5 font-semibold text-slate-400">{patient.hn}</td>
              <td className="px-5 font-black text-slate-900">{patient.name}</td>
              <td className="px-5">
                <Badge className={stageStyles[patient.stage]}>
                  <span className={cn("mr-2 h-2 w-2 rounded-full", stageDotStyles[patient.stage])} />
                  {stageLabel(patient.stage)}
                </Badge>
              </td>
              <td className="px-5 font-semibold text-slate-500">{patient.medicationCount} รายการ</td>
              <td className="px-5">
                <div className="flex gap-2">
                  {patient.alerts.length ? patient.alerts.map((alert) => (
                    <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", alertStyles[alert])} key={alert}>{alertIcon(alert)}</span>
                  )) : <span className="text-slate-300">—</span>}
                </div>
              </td>
              <td className="px-5 font-mono font-bold text-slate-400">{patient.time}</td>
              <td className={cn("px-5 font-black", durationClass(patient.durationMinutes))}>{patient.durationMinutes}m</td>
              <td className="px-5">
                {selectedId === patient.id ? (
                  <Button
                    onClick={(event) => {
                      event.stopPropagation();
                      onClose();
                    }}
                    size="sm"
                  >
                    <X className="h-4 w-4" />
                    ปิด
                  </Button>
                ) : (
                  patient.pharmacist ? (
                    <span className="text-sm font-bold text-slate-400">{patient.pharmacist}</span>
                  ) : (
                    <Button
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelect(patient.id);
                      }}
                      size="sm"
                      variant="secondary"
                    >
                      <Send className="h-4 w-4" />
                      Verify
                    </Button>
                  )
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MobileQueueList({ patients, selectedId, onSelect }: { patients: PatientQueueItem[]; selectedId?: string; onSelect: (id: string) => void }) {
  return (
    <div className="h-full space-y-3 overflow-y-auto p-4 md:hidden">
      {patients.map((patient) => (
        <button
          className={cn("w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm", selectedId === patient.id && "border-blue-300 bg-blue-50")}
          key={patient.id}
          onClick={() => onSelect(patient.id)}
          type="button"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-base font-black">{patient.name}</div>
              <div className="mt-1 text-xs font-bold text-slate-400">VN {patient.vn} · HN {patient.hn}</div>
            </div>
            <span className={cn("text-sm font-black", priorityStyles[patient.priority])}>{patient.priority}</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs font-bold text-slate-400">สถานะ</div>
              <Badge className={cn("mt-1", stageStyles[patient.stage])}>{stageLabel(patient.stage)}</Badge>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-400">Duration</div>
              <div className={cn("mt-1 font-black", durationClass(patient.durationMinutes))}>{patient.durationMinutes}m</div>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-400">รายการยา</div>
              <div className="mt-1 font-black text-slate-600">{patient.medicationCount} รายการ</div>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-400">เวลา</div>
              <div className="mt-1 font-mono font-black text-slate-500">{patient.time}</div>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex gap-2">
              {patient.alerts.length ? patient.alerts.map((alert) => (
                <span className={cn("flex h-8 w-8 items-center justify-center rounded-xl", alertStyles[alert])} key={alert}>{alertIcon(alert)}</span>
              )) : <span className="text-sm font-bold text-slate-300">ไม่มีแจ้งเตือน</span>}
            </div>
            <span className="text-sm font-bold text-slate-400">{patient.pharmacist ?? "รอ Verify"}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

function PatientPanel({ patient, onClose }: { patient: PatientQueueItem; onClose: () => void }) {
  const [hasRequestedStockCheck, setHasRequestedStockCheck] = useState(false);
  const { data: stockCheck, isFetching: isCheckingStock } = useQuery({
    queryKey: ["machine-stock-check", patient.id],
    queryFn: () => getMachineStockCheck(patient),
    enabled: hasRequestedStockCheck,
  });

  function requestStockCheck() {
    setHasRequestedStockCheck(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/25 backdrop-blur-[1px]">
      <button aria-label="ปิดแผงข้อมูลผู้ป่วย" className="hidden flex-1 cursor-default lg:block" onClick={onClose} type="button" />
      <aside className="h-full w-full overflow-y-auto border-l border-slate-200 bg-white shadow-2xl shadow-slate-900/20 sm:max-w-[520px]">
      <div className="flex items-start justify-between border-b border-slate-100 p-5">
        <div>
          <h2 className="text-xl font-black text-slate-950">{patient.name}</h2>
          <p className="mt-2 text-sm font-bold text-slate-400">VN {patient.vn} · HN {patient.hn}</p>
          <div className="mt-4 flex gap-2">
            <Badge className={stageStyles[patient.stage]}>
              <span className={cn("mr-2 h-2 w-2 rounded-full", stageDotStyles[patient.stage])} />
              {stageLabel(patient.stage)}
            </Badge>
            <Badge className="bg-violet-100 text-violet-700"><Pill className="h-3.5 w-3.5" /></Badge>
          </div>
        </div>
        <Button onClick={onClose} size="icon" variant="ghost"><X className="h-5 w-5" /></Button>
      </div>

      <div className="space-y-6 p-5">
        <section>
          <div className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-[0.12em] text-slate-400">
            <AlertTriangle className="h-4 w-4" />
            Issues Detected
          </div>
          <div className="rounded-2xl border border-violet-200 bg-violet-100 p-4 text-violet-900 shadow-sm">
            <div className="flex items-start gap-3">
              <Pill className="mt-1 h-4 w-4 text-violet-600" />
              <div>
                <div className="font-black">{patient.issue?.title ?? "No Critical Issue"}</div>
                <div className="mt-2 text-sm font-medium text-violet-800">{patient.issue?.detail ?? "ยังไม่พบ alert สำคัญในรายการนี้"}</div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-sm font-black text-slate-500">รายการยา ({patient.drugs.length})</h3>
          <div className="space-y-3">
            {patient.drugs.map((drug) => (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" key={drug.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                      <Boxes className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-black text-slate-950">{drug.name}</div>
                      <div className="mt-1 text-sm font-semibold text-slate-500">{drug.sig}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black text-indigo-500">{drug.source}</div>
                    <div className="mt-1 text-xs font-bold text-slate-400">{drug.machineCode}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <Button className="h-14 w-full border-dashed border-blue-200 text-blue-700" disabled={isCheckingStock} onClick={requestStockCheck} variant="outline">
          <Search className="h-5 w-5" />
          {isCheckingStock ? "กำลังตรวจสอบเครื่องและสต็อก" : "ตรวจสอบเครื่องและสต็อก"}
        </Button>

        {hasRequestedStockCheck ? <MachineStockCheck stockCheck={stockCheck} isLoading={isCheckingStock} /> : null}
      </div>
    </aside>
    </div>
  );
}

function MachineStockCheck({ stockCheck, isLoading }: { stockCheck?: StockCheckResponse; isLoading: boolean }) {
  const hasShortage = stockCheck ? !stockCheck.canSetPending : false;

  return (
    <section className="space-y-4 border-t border-slate-100 pt-5">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-black uppercase tracking-[0.14em] text-slate-400">Machine & Stock Check</h3>
        {stockCheck ? (
          <span className={cn("flex h-8 w-8 items-center justify-center rounded-full", stockCheck.canSetPending ? "bg-emerald-100 text-emerald-700" : "bg-yellow-100 text-amber-700")}>
            {stockCheck.canSetPending ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          </span>
        ) : null}
      </div>

      {isLoading && !stockCheck ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-500">กำลังดึงข้อมูลจากเครื่องและสต็อก...</div>
      ) : null}

      {stockCheck ? (
        <>
          <div className="space-y-3">
            {stockCheck.items.map((item) => {
              const isEnough = item.available >= item.required;
              const percentage = Math.min(100, Math.round((item.available / item.capacity) * 100));

              return (
                <div
                  className={cn(
                    "rounded-2xl border p-4 shadow-sm",
                    isEnough ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-yellow-200 bg-yellow-50 text-amber-950",
                  )}
                  key={item.id}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <Pill className={cn("h-6 w-6 shrink-0", isEnough ? "text-emerald-600" : "text-orange-500")} />
                      <div className="min-w-0">
                        <div className="truncate text-base font-black text-slate-950">{item.drugName}</div>
                      </div>
                    </div>
                    <div className={cn("shrink-0 text-sm font-black", isEnough ? "text-emerald-600" : "text-orange-500")}>
                      {isEnough ? "✓ พอ" : "⚠ ไม่พอ"}
                    </div>
                  </div>
                  <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-200">
                    <div className={cn("h-full rounded-full", isEnough ? "bg-emerald-500" : "bg-orange-400")} style={{ width: `${percentage}%` }} />
                  </div>
                  <div className="mt-3 flex flex-col gap-1 text-sm font-bold text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-mono text-cyan-700">{item.machineName}</span>
                    <span>
                      คงเหลือ {item.available}/{item.capacity}
                      {!isEnough ? <span className="ml-2 text-orange-600">ขาด {item.required - item.available} ที่ {item.machineName}</span> : null}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {hasShortage ? (
            <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-amber-950">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                <div>
                  <div className="font-black">ยาไม่เพียงพอ — ต้องตั้ง Pending</div>
                  <div className="mt-2 text-sm font-semibold leading-6 text-amber-900">{stockCheck.shortageMessage}</div>
                </div>
              </div>
            </div>
          ) : null}

          <Button
            className={cn(
              "h-14 w-full text-base",
              stockCheck.canSetPending
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                : "bg-yellow-100 text-amber-900 hover:bg-yellow-100 disabled:opacity-100",
            )}
            disabled={!stockCheck.canSetPending}
            onClick={() => toast.success("ตั้ง Pending สำเร็จ")}
          >
            {stockCheck.canSetPending ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
            {stockCheck.canSetPending ? "Set Pending" : "Set Pending — ยาไม่พอ"}
          </Button>
        </>
      ) : null}
    </section>
  );
}
