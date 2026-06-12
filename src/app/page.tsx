"use client";

import { useState } from "react";
import { AuthScreen } from "@/features/auth/AuthScreen";
import { PharmacyDashboard } from "@/features/queue/PharmacyDashboard";

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
