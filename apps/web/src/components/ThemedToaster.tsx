"use client";

import { Toaster } from "sonner";
import { useTheme } from "@/app/theme-provider";

export function ThemedToaster() {
  const { theme } = useTheme();
  return <Toaster position="top-right" richColors theme={theme} />;
}
