"use client";

import { useState } from "react";
import { Button } from "./ui";

export function BillingPortalButton() {
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState("");

  return (
    <div>
      <Button
        tone="line"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setHint("");
          void fetch("/api/billing/portal", { method: "POST" })
            .then(async (res) => {
              const data = (await res.json()) as { url?: string; error?: string };
              if (data.url) {
                window.location.href = data.url;
                return;
              }
              setHint(data.error || "Could not open billing portal.");
            })
            .catch(() => setHint("Could not open billing portal."))
            .finally(() => setBusy(false));
        }}
      >
        {busy ? "Opening…" : "Manage billing"}
      </Button>
      {hint ? <p className="mt-2 text-xs text-warn">{hint}</p> : null}
    </div>
  );
}
