"use client";

import { Activity, Eye, EyeOff, ShieldCheck, UserPlus } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function AuthScreen({ onLogin }: { onLogin: () => void }) {
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
