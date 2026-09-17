"use client";

import { useEffect, useState } from "react";
import { Button } from "./ui";
import { PAYWALL_EVENT, type PaywallPayload } from "@/lib/paywall";

export function UpgradeModal() {
  const [open, setOpen] = useState<PaywallPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState("");

  useEffect(() => {
    function onPaywall(event: Event) {
      const detail = (event as CustomEvent<PaywallPayload>).detail;
      setHint("");
      setOpen(detail);
    }
    window.addEventListener(PAYWALL_EVENT, onPaywall);
    return () => window.removeEventListener(PAYWALL_EVENT, onPaywall);
  }, []);

  if (!open) return null;

  async function checkout(plan: "starter" | "scaler") {
    setBusy(true);
    setHint("");
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setHint(data.error || "Checkout is not available yet.");
    } catch {
      setHint("Could not start checkout.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-ink/40 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-[0_18px_50px_rgba(15,18,34,0.18)]">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">SetoStore upgrade</p>
        <h2 className="mt-2 text-xl font-semibold">You&apos;ve tested your 5 free products</h2>
        <p className="mt-2 text-sm text-muted">{open.message}</p>
        <div className="mt-4 rounded-xl border border-line bg-surface-2 p-4">
          <p className="text-sm font-semibold">Starter plan</p>
          <p className="mt-1 text-2xl font-semibold">$19<span className="text-sm font-medium text-muted"> / month</span></p>
          <ul className="mt-3 space-y-1 text-sm text-muted">
            <li>30 product imports / month</li>
            <li>Margin Guard on up to 5 ad sets</li>
            <li>50 Lens lookups / month</li>
          </ul>
        </div>
        {hint ? <p className="mt-3 text-xs text-warn">{hint}</p> : null}
        <Button className="mt-4 w-full" tone="accent" disabled={busy} onClick={() => void checkout("starter")}>
          Unlock Starter ($19/mo)
        </Button>
        <button
          type="button"
          className="mt-3 w-full text-sm text-muted hover:text-ink"
          onClick={() => setOpen(null)}
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
