"use client";

import { useTransition } from "react";
import { runAllGuards, runCampaignGuard, togglePause } from "@/app/actions/campaigns";
import { money } from "@/lib/utils";
import { Badge, Button, Card, CardHeader } from "./ui";

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
  profit: number;
  roas: number;
  atRisk: boolean;
  product?: { cleanTitle: string | null; rawTitle: string } | null;
};

export function AdsDesk({ campaigns }: { campaigns: CampaignRow[] }) {
  const [pending, start] = useTransition();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">Ads & Guard</p>
          <h1 className="mt-1 text-2xl font-semibold">Kill losers before they eat the store</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Circuit breaker: if spend hits the daily cap and net profit is negative (or ROAS is under
            the floor), the ad set is paused. Live Meta/TikTok tokens pause the real campaign; demo
            pauses only in this desk.
          </p>
        </div>
        <Button tone="accent" disabled={pending} onClick={() => start(() => { void runAllGuards(); })}>
          Run all circuit checks
        </Button>
      </div>

      <Card className="p-5">
        <p className="font-mono text-sm text-profit">
          Net profit = attributed revenue − COGS − ad spend − (revenue × 0.029 + $0.30)
        </p>
        <p className="mt-2 text-xs text-muted">
          Cron this with GET /api/cron/margin-guard?secret=CRON_SECRET every 15 minutes once ads are live.
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {campaigns.map((c) => (
          <Card key={c.id} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-faint">{c.platform}</p>
                <h2 className="mt-1 text-base font-semibold">{c.adSetName}</h2>
                <p className="text-xs text-muted">
                  {c.product?.cleanTitle ?? c.product?.rawTitle ?? "Unmapped SKU"}
                </p>
              </div>
              {c.isPaused ? (
                <Badge tone="line">Paused</Badge>
              ) : c.atRisk ? (
                <Badge tone="loss">At risk</Badge>
              ) : (
                <Badge tone="profit">Healthy</Badge>
              )}
            </div>
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
                <dt className="text-[11px] text-faint">ROAS</dt>
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
              <Button tone="line" disabled={pending} onClick={() => start(() => { void runCampaignGuard(c.id); })}>
                Circuit check
              </Button>
              <Button
                tone={c.isPaused ? "profit" : "loss"}
                disabled={pending}
                onClick={() => start(() => { void togglePause(c.id, !c.isPaused); })}
              >
                {c.isPaused ? "Resume locally" : "Pause locally"}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
