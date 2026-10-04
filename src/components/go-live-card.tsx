"use client";

import { useState, useTransition } from "react";
import { createPracticeOrder } from "@/app/actions/smoke-order";
import { Badge, Button, Card } from "./ui";
import { CopyButton } from "./copy-button";
import { DeskLink } from "./desk-link";

type Check = {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
  owner: "ready" | "railway" | "meta" | "you";
};

export function GoLiveCard({
  softLaunchOk,
  chargeOk,
  checks,
  metaReviewUrls,
}: {
  softLaunchOk: boolean;
  chargeOk: boolean;
  checks: Check[];
  metaReviewUrls: {
    privacy: string;
    terms: string;
    oauthRedirect: string;
    dataDeletion: string;
  };
}) {
  const [pending, start] = useTransition();
  const [smokeMsg, setSmokeMsg] = useState("");

  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">Seto launch</p>
          <h2 className="mt-1 text-sm font-semibold">Platform go-live status</h2>
          <p className="mt-1 text-xs text-muted">
            Soft launch = desk + Meta for testers. Paid plans need live platform Stripe. Merchant Stripe is each
            seller&apos;s own checkout — not a Seto gap.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={softLaunchOk ? "profit" : "warn"}>
            {softLaunchOk ? "Soft launch ready" : "Soft launch blocked"}
          </Badge>
          <Badge tone={chargeOk ? "profit" : "line"}>
            {chargeOk ? "Paid plans ready" : "Paid plans later"}
          </Badge>
        </div>
      </div>

      <ul className="space-y-2">
        {checks.map((c) => (
          <li key={c.id} className="rounded-xl border border-line px-3 py-2">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-ink">{c.label}</p>
              <Badge tone={c.ok ? "profit" : c.owner === "railway" ? "warn" : "line"}>
                {c.ok ? "ok" : c.owner}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted">{c.detail}</p>
          </li>
        ))}
      </ul>

      <div className="rounded-xl border border-line bg-[rgba(0,0,0,0.02)] px-3 py-3">
        <p className="text-xs font-semibold text-ink">Meta App Review URLs (paste in Meta Developer)</p>
        <ul className="mt-2 space-y-2 text-xs text-muted">
          <li className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono break-all">{metaReviewUrls.privacy}</span>
            <CopyButton text={metaReviewUrls.privacy} label="Copy privacy" />
          </li>
          <li className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono break-all">{metaReviewUrls.oauthRedirect}</span>
            <CopyButton text={metaReviewUrls.oauthRedirect} label="Copy OAuth" />
          </li>
          <li className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono break-all">{metaReviewUrls.dataDeletion}</span>
            <CopyButton text={metaReviewUrls.dataDeletion} label="Copy deletion" />
          </li>
        </ul>
        <p className="mt-2 text-xs text-faint">
          Submit App Review in Meta only when non-admin customers need Connect. Your desk works in Development with
          testers.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          tone="accent"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setSmokeMsg("");
              const res = await createPracticeOrder();
              if ("error" in res && res.error) {
                setSmokeMsg(res.error);
                return;
              }
              setSmokeMsg(`Created ${res.orderNumber} — open Fulfill and walk tracking.`);
            })
          }
        >
          {pending ? "Creating…" : "Create practice order"}
        </Button>
        <DeskLink href="/fulfillment" className="text-xs text-accent">
          Open Fulfill →
        </DeskLink>
      </div>
      {smokeMsg ? <p className="text-xs text-muted">{smokeMsg}</p> : null}
    </Card>
  );
}
