"use client";

import { toast } from "sonner";
import { Message } from "./index";
import type { MessageValue } from "./messages";

// Mounted notifications also react to a language change; server text stays raw.
export const uiToast = {
  success: (value: MessageValue) => toast.success(<Message value={value} />),
  error: (value: MessageValue) => toast.error(<Message value={value} />),
  info: (value: MessageValue) => toast.info(<Message value={value} />),
};
