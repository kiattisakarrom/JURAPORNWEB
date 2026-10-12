import type { TranslationKey } from "@/i18n/messages";
import type { LucideIcon } from "lucide-react";

export type WorkspaceScreen = "verify" | "matching" | "checking" | "dispensing" | "dashboard" | "me" | "drugmaster";

export type WorkspaceNavItem = {
  id: WorkspaceScreen;
  label: TranslationKey;
  subtitle: TranslationKey;
  icon: LucideIcon;
};
