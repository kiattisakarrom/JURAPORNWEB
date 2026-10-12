"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useMemo } from "react";
import { Toaster } from "sonner";
import { I18nProvider, useTranslation } from "@/i18n";

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = useMemo(() => new QueryClient(), []);

  return (
    <I18nProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      <WorkspaceNotifications />
    </I18nProvider>
  );
}


function WorkspaceNotifications() {
  const { excluded } = useTranslation();
  return (
    <Toaster
      position="top-right"
      richColors
      style={{ fontFamily: "var(--font-sans)" }}
      className={excluded ? undefined : "workspace-notifications"}
      offset={{ top: "var(--workspace-toast-top, 24px)" }}
    />
  );
}
