"use client";

import { Activity } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthScreen } from "@/features/auth/AuthScreen";
import { PharmacyDashboard } from "@/features/queue/PharmacyDashboard";
import { clearRealtimeQueueCache } from "@/hooks/useRealtimeQueue";

type SessionState = "loading" | "authenticated" | "anonymous";

export function WorkspaceApp() {
  const router = useRouter();
  const [sessionState, setSessionState] = useState<SessionState>("loading");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSessionState(window.localStorage.getItem("pharmauto-session") === "active" ? "authenticated" : "anonymous");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function handleLogin() {
    window.localStorage.setItem("pharmauto-session", "active");
    setSessionState("authenticated");
  }

  function handleLogout() {
    clearRealtimeQueueCache();
    window.localStorage.removeItem("pharmauto-session");
    setSessionState("anonymous");
    router.replace("/verify", { scroll: false });
  }

  if (sessionState === "loading") {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#eef1f5] text-[#1e2a3a]">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-500 shadow-sm">
          <Activity className="h-5 w-5 animate-pulse text-blue-600" />
          กำลังเตรียม Workstation...
        </div>
      </main>
    );
  }

  return sessionState === "authenticated"
    ? <PharmacyDashboard onLogout={handleLogout} />
    : <AuthScreen onLogin={handleLogin} />;
}
