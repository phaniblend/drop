"use client";

import { useEffect, useState } from "react";

/** Loads Meta Pixel only after marketing cookie consent. */
export function StorePixel({ metaPixelId }: { metaPixelId: string }) {
  const [allowed, setAllowed] = useState(false);
  const id = metaPixelId.replace(/\D/g, "");

  useEffect(() => {
    if (!id) return;
    try {
      if (localStorage.getItem("seto_cookie_consent_v1") === "all") setAllowed(true);
    } catch {
      /* ignore */
    }
    const onConsent = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail === "all") setAllowed(true);
    };
    window.addEventListener("seto-cookie-consent", onConsent);
    return () => window.removeEventListener("seto-cookie-consent", onConsent);
  }, [id]);

  useEffect(() => {
    if (!allowed || !id || typeof window === "undefined") return;
    const w = window as Window & { fbq?: (...args: unknown[]) => void; _fbq?: unknown };
    if (w.fbq) {
      w.fbq("init", id);
      w.fbq("track", "PageView");
      return;
    }
    const n = function (...args: unknown[]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (n as any).callMethod ? (n as any).callMethod.apply(n, args) : (n as any).queue.push(args);
    } as ((...args: unknown[]) => void) & { queue: unknown[]; loaded: boolean; version: string; callMethod?: unknown };
    n.queue = [];
    n.loaded = true;
    n.version = "2.0";
    w.fbq = n;
    w._fbq = n;
    const t = document.createElement("script");
    t.async = true;
    t.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(t);
    n("init", id);
    n("track", "PageView");
  }, [allowed, id]);

  return null;
}
