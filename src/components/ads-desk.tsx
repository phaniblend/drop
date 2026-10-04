"use client";

import { useState, useTransition } from "react";
import {
  previewCampaignGuard,
  runAllGuards,
  runCampaignGuard,
  saveSentinelSettings,
  togglePause,
} from "@/app/actions/campaigns";
import { money } from "@/lib/utils";
import { Badge, Button, Card, CardHeader, Field, inputClass } from "./ui";
import { emitPaywall, hasPaywall } from "@/lib/paywall";
import { isPaidLaunchUnlocked, parseSentinelSettings, type SentinelSettings } from "@/lib/ad-protection";
import { friendlyMetaError } from "@/lib/meta-status";
import { DeskLink } from "./desk-link";
import { explainReasonCode, explainVerdict } from "@/lib/margin-guard-v2/why";

type CampaignRow = {
  id: string;
  adSetId: string;
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
  sample?: boolean;
  product?: {
    cleanTitle: string | null;
    rawTitle: string;
    organicStatus?: string | null;
    organicViewsJson?: string | null;
  } | null;
};

type WhyEval = {
  verdict: string;
  reasonCodes: string[];
  formulaVersion: string;
  evaluatedAtUtc: string;
  inputs: Record<string, number | null>;
};

export function AdsDesk({
  campaigns,
  sentinelRaw,
  daypartingEnabled,
  adsLive = false,
  metaFullyConnected = false,
  metaDegraded = false,
  metaAccountId = "",
  metaError = null,
  metaFetchedCount = null,
  guardMode = "ALERT_ONLY",
  whyByAdset = {},
  guardLog = [],
}: {
  campaigns: CampaignRow[];
  sentinelRaw: string;
  daypartingEnabled: boolean;
  adsLive?: boolean;
  metaFullyConnected?: boolean;
  metaDegraded?: boolean;
  metaAccountId?: string;
  metaError?: string | null;
  metaFetchedCount?: number | null;
  guardMode?: string;
  whyByAdset?: Record<string, WhyEval>;
  guardLog?: Array<{ id: string; message: string }>;
}) {
  const [pending, start] = useTransition();
  const initial = parseSentinelSettings(sentinelRaw);
  const [sentinel, setSentinel] = useState<SentinelSettings>(initial);
  const [saved, setSaved] = useState("");
  const [pauseError, setPauseError] = useState("");
  const [preview, setPreview] = useState<Record<string, string>>({});
  const [checkMsg, setCheckMsg] = useState("");
  const [whyOpen, setWhyOpen] = useState<Record<string, boolean>>({});

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">Ads & Guard</p>
          <h1 className="mt-1 text-2xl font-semibold">Kill losers before they eat the store</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Pauses ads that are losing money, and watches the first clicks before anyone buys. Quiet hours
            {daypartingEnabled ? " are on" : " are off"} in Settings. Guard mode:{" "}
            <span className="font-medium text-ink">{guardMode.replace(/_/g, " ").toLowerCase()}</span>.
          </p>
          <p className="mt-2 max-w-2xl text-xs text-muted">
            How matching works: create the ad set in Meta Ads Manager with a UTM link from Catalog → Ad creatives
            (utm_campaign / utm_content). Guard reads Meta spend and matches sales from your Seto store orders (or
            Shopify if connected). Link a product on each campaign row when names do not match.
          </p>
          {metaFullyConnected ? (
            <p className="mt-2 text-xs text-profit">Meta or TikTok is connected — a real pause can hit the live ad set.</p>
          ) : metaDegraded ? (
            <p className="mt-2 text-xs text-warn">
              Margin Guard is not protecting spend — finish Meta setup (account ID + long-lived token).
            </p>
          ) : adsLive ? (
            <p className="mt-2 text-xs text-profit">TikTok is connected — a real pause can hit the live ad set.</p>
          ) : campaigns.some((c) => c.sample) ? (
            <p className="mt-2 text-xs text-warn">
              Showing sample campaigns so you can learn Guard before connecting ads. Preview works; pause stays local
              until Meta/TikTok are linked in Settings.
            </p>
          ) : (
            <p className="mt-2 text-xs text-warn">
              Meta and TikTok are not connected. Checks stay in this desk. Connect those accounts in Settings before
              trusting this with real spend.
            </p>
          )}
          {checkMsg ? <p className="mt-2 text-xs text-muted">{checkMsg}</p> : null}
        </div>
        <Button
          tone="accent"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setCheckMsg("");
              try {
                const res = await runAllGuards();
                setCheckMsg(`Checked ${res.results.length} ads.`);
              } catch {
                setCheckMsg("Could not check ads. Try again.");
              }
            })
          }
        >
          {pending ? "Checking…" : "Check all ads now"}
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
          Ads are checked automatically every hour.
          {daypartingEnabled
            ? " Quiet hours (1:00–6:00 store time) pause spend while shoppers are asleep."
            : " Quiet hours are off in Settings."}{" "}
          Use Preview pause to see why an ad would stop before it actually stops — Preview never calls Meta
          or TikTok pause APIs.
        </p>
      </Card>

      {metaDegraded ? (
        <Card className="p-5">
          <p className="text-sm font-semibold text-ink">Finish Meta setup</p>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted">
            <li>Settings → Meta ads → Connect with Facebook (Seto owns the app — you only approve access).</li>
            <li>After connect, pick your ad account if more than one is listed.</li>
            <li>Confirm Ads & Guard shows Connected, then run Check all ads.</li>
          </ol>
          {metaError ? (
            <p className="mt-3 text-sm text-loss">{friendlyMetaError(metaError)}</p>
          ) : null}
          <DeskLink href="/settings#meta" className="mt-3 inline-block">
            <Button tone="accent">Reconnect Meta</Button>
          </DeskLink>
        </Card>
      ) : null}

      {metaError && !metaDegraded ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-loss/30 bg-[rgba(255,107,122,0.08)] px-4 py-3">
          <p className="text-sm text-loss">{friendlyMetaError(metaError)}</p>
          <DeskLink href="/settings#meta">
            <Button tone="line">Reconnect Meta</Button>
          </DeskLink>
        </div>
      ) : null}

      {metaFullyConnected && campaigns.length === 0 ? (
        <Card className="p-5">
          <p className="text-sm text-muted">
            Meta connected — no active campaigns yet.
            {metaFetchedCount === 0 ? " Create an ad set in Ads Manager, then check again." : ""}
          </p>
        </Card>
      ) : null}

      {guardLog.length ? (
        <Card>
          <CardHeader eyebrow="Why it paused" title="Recent Guard checks" />
          <ul className="divide-y divide-line">
            {guardLog.map((item) => (
              <li key={item.id} className="px-5 py-3 text-sm text-muted">
                {item.message}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

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
                  {c.sample ? <Badge tone="warn">DEMO</Badge> : null}
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
                  Paid launch locked — finish the 3-video organic test on Command.
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
              {preview[c.id] ? <p className="mt-3 text-xs text-muted">{preview[c.id]}</p> : null}
              {whyOpen[c.id] && whyByAdset[c.adSetId] ? (
                <div className="mt-3 space-y-2 rounded-lg border border-line bg-[rgba(0,0,0,0.02)] px-3 py-3 text-xs text-muted">
                  <p className="font-medium text-ink">{explainVerdict(whyByAdset[c.adSetId].verdict)}</p>
                  <p className="font-mono text-[10px] text-faint">
                    {whyByAdset[c.adSetId].formulaVersion} ·{" "}
                    {new Date(whyByAdset[c.adSetId].evaluatedAtUtc).toLocaleString()}
                  </p>
                  <ul className="list-disc space-y-1 pl-4">
                    {whyByAdset[c.adSetId].reasonCodes.map((code) => (
                      <li key={code}>{explainReasonCode(code)}</li>
                    ))}
                  </ul>
                  <dl className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                    <div>
                      <dt className="text-faint">Spend (S)</dt>
                      <dd>{money(Number(whyByAdset[c.adSetId].inputs.S ?? 0))}</dd>
                    </div>
                    <div>
                      <dt className="text-faint">Floor (F)</dt>
                      <dd>{money(Number(whyByAdset[c.adSetId].inputs.F ?? 0))}</dd>
                    </div>
                    <div>
                      <dt className="text-faint">Net shop</dt>
                      <dd>{money(Number(whyByAdset[c.adSetId].inputs.Net_shop ?? 0))}</dd>
                    </div>
                    <div>
                      <dt className="text-faint">Net meta</dt>
                      <dd>{money(Number(whyByAdset[c.adSetId].inputs.Net_meta ?? 0))}</dd>
                    </div>
                  </dl>
                </div>
              ) : whyOpen[c.id] ? (
                <p className="mt-3 text-xs text-muted">
                  No dual-signal evaluation yet — it runs on the hourly cron after Meta insights sync.
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  tone="line"
                  disabled={pending}
                  onClick={() => setWhyOpen((prev) => ({ ...prev, [c.id]: !prev[c.id] }))}
                >
                  Why?
                </Button>
                <Button
                  tone="line"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const res = await previewCampaignGuard(c.id);
                      setPreview((prev) => ({ ...prev, [c.id]: res.explanation }));
                    })
                  }
                >
                  Preview pause
                </Button>
                <Button
                  tone="line"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const res = await runCampaignGuard(c.id);
                      setPreview((prev) => ({ ...prev, [c.id]: res.explanation }));
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
