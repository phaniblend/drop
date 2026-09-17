"use client";

import { emitPaywall } from "@/lib/paywall";
import type { BillingSummary } from "@/lib/paywall";
import { Badge, Button } from "./ui";

export function TrialBadge({ billing }: { billing: BillingSummary }) {
  const trial = billing.tier === "trial_5";
  const used = billing.productsUsed;
  const limit = billing.productsLimit;
  const full = used >= limit;

  return (
    <div className="flex items-center gap-1.5">
      <Badge tone={full ? "warn" : trial ? "accent" : "profit"}>
        {trial ? `Free trial: ${used} / ${limit}` : `${billing.label}: ${used} / ${limit}`}
      </Badge>
      {trial ? (
        <Button
          className="hidden h-8 px-2 text-xs sm:inline-flex"
          tone="accent"
          onClick={() =>
            emitPaywall({
              code: "TRIAL_LIMIT_REACHED",
              message: "Continue testing winning products without interruption.",
              limit,
              used,
              resource: "products",
            })
          }
        >
          Upgrade
        </Button>
      ) : null}
    </div>
  );
}
