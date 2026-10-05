"use client";

import { useState } from "react";
import { Button } from "./ui";

type Plan = "starter" | "scaler";

export function PlanCheckoutButtons({
  signedIn = true,
  compact = false,
  plans = ["starter", "scaler"],
}: {
  signedIn?: boolean;
  compact?: boolean;
  plans?: Plan[];
}) {
  const [busy, setBusy] = useState<Plan | "">("");
  const [hint, setHint] = useState("");

  async function checkout(plan: Plan) {
    if (!signedIn) {
      window.location.href = "/login?next=/pricing";
      return;
    }
    setBusy(plan);
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
      setHint(data.error || "Membership checkout is not live yet.");
    } catch {
      setHint("Could not start checkout.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className={compact ? "flex flex-col gap-2" : "mt-4 flex flex-col gap-2"}>
      {plans.includes("starter") ? (
        <Button
          tone="accent"
          busy={busy === "starter"}
          disabled={Boolean(busy)}
          onClick={() => void checkout("starter")}
        >
          {busy === "starter" ? "Opening Stripe…" : compact ? "Starter $19/mo" : "Start Starter — $19/mo"}
        </Button>
      ) : null}
      {plans.includes("scaler") ? (
        <Button
          tone={plans.length > 1 ? "line" : "accent"}
          busy={busy === "scaler"}
          disabled={Boolean(busy)}
          onClick={() => void checkout("scaler")}
        >
          {busy === "scaler" ? "Opening Stripe…" : compact ? "Scaler $39/mo" : "Start Scaler — $39/mo"}
        </Button>
      ) : null}
      {hint ? <p className="text-xs text-warn">{hint}</p> : null}
    </div>
  );
}
