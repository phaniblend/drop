"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    __dsInstallPrompt?: BeforeInstallPromptEvent;
  }
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaRegister() {
  useEffect(() => {
    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      window.__dsInstallPrompt = event as BeforeInstallPromptEvent;
      window.dispatchEvent(new Event("ds-pwa-prompt"));
    });

    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* installability still works from the manifest */
    });
  }, []);

  return null;
}
