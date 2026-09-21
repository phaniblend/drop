"use client";

import { useState, useTransition } from "react";
import { runAllGuards, runCampaignGuard, saveSentinelSettings, togglePause } from "@/app/actions/campaigns";
import { money } from "@/lib/utils";
import { Badge, Button, Card, CardHeader, Field, inputClass } from "./ui";
import { emitPaywall, hasPaywall } from "@/lib/paywall";
import { isPaidLaunchUnlocked, parseSentinelSettings, type SentinelSettings } from "@/lib/ad-protection";

type CampaignRow = {
  id: string;
  adSetName: string | null;
  platform: string;
  spendToday: number;
  revenueToday: number;
  ordersCount: number;
  spendLimitThreshold: number;
  minRoasThreshold: number;
  isPaused: boolean;
  impressions: number;
  clicks: number;
  addToCartCount: number;
  ctr: number;
  cpc: number;
  pauseReason: string | null;
  pauseSource: string | null;
  profit: number;
  roas: number;
  atRisk: boolean;
  product?: {
    cleanTitle: string | null;
    rawTitle: string;
    organicStatus?: string | null;
    organicViewsJson?: string | null;
  } | null;
};

export function AdsDesk({
  campaigns,
  sentinelRaw,
  daypartingEnabled,
}: {
  campaigns: CampaignRow[];
  sentinelRaw: string;
  daypartingEnabled: boolean;
}) {
  const [pending, start] = useTransition();
  const initial = parseSentinelSettings(sentinelRaw);
  const [sentinel, setSentinel] = useState<SentinelSettings>(initial);
  const [saved, setSaved] = useState("");
  const [pauseError, setPauseError] = useState("");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">Ads & Guard</p>
          <h1 className="mt-1 text-2xl font-semibold">Kill losers before they eat the store</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Pauses ads that are losing money, and watches the first clicks before anyone buys. Live Meta/TikTok tokens pause the real ad set; demo pauses
            only in this desk. Dayparting {daypartingEnabled ? "is on" : "is off"} in Settings.
          </p>
        </div>
        <Button
          tone="accent"
          disabled={pending}
          onClick={() =>
            start(() => {
              void runAllGuards();
            })
          }
        >
          Check all ads now
        </Button>
      </div>

      <Card>
        <CardHeader eyebrow="Early warning" title="First clicks before anyone buys" />
        <form
          className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-5"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const next = await saveSentinelSettings(sentinel);
              setSentinel(next);
              setSaved("Sentinel saved.");
            });
          }}
        >
          <label className="flex items-center gap-2 text-sm sm:col-span-2 lg:col-span-5">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[#5B5FFF]"
              checked={sentinel.enabled}
              onChange={(e) => setSentinel({ ...sentinel, enabled: e.target.checked })}
            />
            Enable early kill-switch
          </label>
          <Field label="Hook spend floor ($)">
            <input
              className={inputClass}
              type="number"
              step="0.5"
              value={sentinel.hookSpend}
              onChange={(e) => setSentinel({ ...sentinel, hookSpend: Number(e.target.value) })}
            />
          </Field>
          <Field label="Min click rate %">
            <input
              className={inputClass}
              type="number"
              step="0.1"
              value={sentinel.minCtr}
              onChange={(e) => setSentinel({ ...sentinel, minCtr: Number(e.target.value) })}
            />
          </Field>
          <Field label="Max cost per click ($)">
            <input
              className={inputClass}
              type="number"
              step="0.1"
              value={sentinel.maxCpc}
              onChange={(e) => setSentinel({ ...sentinel, maxCpc: Number(e.target.value) })}
            />
          </Field>
          <Field label="Intent spend floor ($)">
            <input
              className={inputClass}
              type="number"
              step="0.5"
              value={sentinel.intentSpend}
              onChange={(e) => setSentinel({ ...sentinel, intentSpend: Number(e.target.value) })}
            />
          </Field>
          <div className="flex items-end">
            <Button type="submit" tone="line" disabled={pending}>
              Save early warning
            </Button>
          </div>
          <p className="text-xs text-muted sm:col-span-2 lg:col-span-5">
            Weak hook: spend hits the floor and (click rate is below min or cost per click is above max) → pause. No carts:
            spend hits the floor and nobody adds to cart → pause.
          </p>
          {saved ? <p className="text-xs text-profit sm:col-span-2 lg:col-span-5">{saved}</p> : null}
        </form>
      </Card>

      {pauseError ? (
        <p className="rounded-xl border border-loss/30 bg-[rgba(255,107,122,0.08)] px-4 py-3 text-sm text-loss">
          {pauseError}
        </p>
      ) : null}

      <Card className="p-5">
        <p className="font-mono text-sm text-profit">
          Net profit = sales from the ad − what you paid for the products − ad spend − card fees (2.9% + $0.30)
        </p>
        <p className="mt-2 text-xs text-muted">
          Ads are checked automatically every 15 minutes. Quiet hours (1:00–6:00 store time) pause spend while
          shoppers are asleep.
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {campaigns.map((c) => {
          const locked = c.product ? !isPaidLaunchUnlocked(c.product) : false;
          return (
            <Card key={c.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wider text-faint">{c.platform}</p>
                  <h2 className="mt-1 text-base font-semibold">{c.adSetName}</h2>
                  <p className="text-xs text-muted">{c.product?.cleanTitle ?? c.product?.rawTitle ?? "No product linked"}</p>
                </div>
                {c.isPaused ? (
                  <Badge tone="line">{c.pauseReason ?? "Paused"}</Badge>
                ) : c.atRisk ? (
                  <Badge tone="loss">At risk</Badge>
                ) : (
                  <Badge tone="profit">Healthy</Badge>
                )}
              </div>
              {locked ? (
                <p className="mt-3 rounded-lg border border-warn/30 bg-[rgba(232,168,56,0.08)] px-3 py-2 text-xs text-warn">
                  Paid launch locked — finish the 3-video organic test in Daily ops.
                </p>
              ) : null}
              <dl className="mt-4 grid grid-cols-2 gap-3 font-mono text-sm">
                <div>
                  <dt className="text-[11px] text-faint">Spend</dt>
                  <dd>
                    {money(c.spendToday)} / {money(c.spendLimitThreshold)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-faint">Revenue</dt>
                  <dd>{money(c.revenueToday)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-faint">Click rate / cost per click</dt>
                  <dd>
                    {c.ctr.toFixed(2)}% · {money(c.cpc)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-faint">Add to cart</dt>
                  <dd>{c.addToCartCount}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-faint">Sales per ad $</dt>
                  <dd>
                    {c.roas.toFixed(2)}x <span className="text-faint">(min {c.minRoasThreshold.toFixed(2)})</span>
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-faint">Net</dt>
                  <dd className={c.profit >= 0 ? "text-profit" : "text-loss"}>{money(c.profit)}</dd>
                </div>
              </dl>
              <div className="mt-4 flex gap-2">
                <Button
                  tone="line"
                  disabled={pending}
                  onClick={() =>
                    start(() => {
                      void runCampaignGuard(c.id);
                    })
                  }
                >
                  Check ads
                </Button>
                <Button
                  tone={c.isPaused ? "profit" : "loss"}
                  disabled={pending || (c.isPaused && locked)}
                  onClick={() =>
                    start(async () => {
                      setPauseError("");
                      const res = await togglePause(c.id, !c.isPaused);
                      if (hasPaywall(res)) emitPaywall(res.paywall);
                      if ("error" in res && res.error) setPauseError(res.error);
                    })
                  }
                >
                  {c.isPaused ? "Resume locally" : "Pause locally"}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
