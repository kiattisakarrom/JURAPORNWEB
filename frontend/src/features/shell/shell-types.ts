import type { LucideIcon } from "lucide-react";

export type WorkspaceScreen = "verify" | "matching" | "checking" | "dispensing" | "dashboard" | "me";

export type WorkspaceNavItem = {
  id: WorkspaceScreen;
  label: string;
  subtitle: string;
  icon: LucideIcon;
};
