"use client";

import { useState, useTransition } from "react";
import { resetDemoData, saveOperatorSettings } from "@/app/actions/settings";
import { SignOutButton } from "./sign-out-button";
import { Badge, Button, Card, CardHeader, Field, inputClass } from "./ui";
import { PwaInstallButton } from "./pwa-install-button";
import { emitPaywall } from "@/lib/paywall";
import type { BillingSummary } from "@/lib/paywall";

type Status = {
  shopify: boolean;
  meta: boolean;
  tiktok: boolean;
  aliexpress: boolean;
  serp: boolean;
  ai: boolean;
  scrape: boolean;
  demo: boolean;
  liveCount: number;
};

export function SettingsDesk({
  status,
  user,
  billing,
}: {
  status: Status;
  billing: BillingSummary;
  user: {
    displayName: string;
    storeName: string;
    email: string;
    markupMultiplier: number;
    spendLimitThreshold: number;
    minRoasThreshold: number;
    timezone: string;
    daypartingEnabled: boolean;
  };
}) {
  const [pending, start] = useTransition();
  const [form, setForm] = useState(user);
  const [msg, setMsg] = useState("");

  const connections = [
    {
      name: "Shopify Admin API",
      ok: status.shopify,
      need: "SHOPIFY_STORE_DOMAIN + SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET",
      why: "Publish products and capture orders/create webhooks.",
    },
    {
      name: "Meta Marketing API",
      ok: status.meta,
      need: "META_ACCESS_TOKEN (+ META_AD_ACCOUNT_ID)",
      why: "Hourly spend polling and auto-pause.",
    },
    {
      name: "TikTok Marketing API",
      ok: status.tiktok,
      need: "TIKTOK_ACCESS_TOKEN + TIKTOK_ADVERTISER_ID",
      why: "Ad group analytics and disable.",
    },
    {
      name: "AliExpress Open API",
      ok: status.aliexpress,
      need: "ALIEXPRESS_APP_KEY + SECRET (+ ACCESS_TOKEN)",
      why: "Official catalog instead of the demo feed / scrape.",
    },
    {
      name: "SerpApi Google Lens",
      ok: status.serp,
      need: "SERPAPI_KEY",
      why: "Reverse-search competitor ads to supplier URLs.",
    },
    {
      name: "AI copy (Vercel AI Gateway)",
      ok: status.ai,
      need: "AI_GATEWAY_API_KEY",
      why: "Rewrite wholesale titles into storefront copy.",
    },
    {
      name: "Headless scrape",
      ok: status.scrape,
      need: "Playwright Chromium (no API key)",
      why: "Import URL fetches AliExpress HTML, then falls back to headless Chromium if blocked.",
    },
    {
      name: "Stripe Billing",
      ok: billing.stripeReady,
      need: "STRIPE_SECRET_KEY + STRIPE_PRICE_STARTER (+ STRIPE_PRICE_SCALER)",
      why: "Checkout for Starter $19 / Scaler $39 after the 5-product trial.",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">Settings</p>
        <h1 className="mt-1 text-xl font-semibold sm:text-2xl">Store + integrations</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Connected APIs replace sandbox data. Paste keys into <code className="font-mono">.env.local</code>{" "}
          (see <code className="font-mono">env.example</code>).
        </p>
        <PwaInstallButton />
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">Plan</p>
            <h2 className="mt-1 text-sm font-semibold">{billing.label}</h2>
            <p className="mt-2 text-sm text-muted">
              {billing.productsUsed} / {billing.productsLimit} product imports
              {billing.period === "month" ? " this month" : " on this trial"}. Lens {billing.lensUsed} /{" "}
              {billing.lensLimit}. Margin Guard {billing.campaignsUsed} /{" "}
              {Number.isFinite(billing.campaignsLimit) ? billing.campaignsLimit : "∞"} campaigns.
            </p>
            <p className="mt-2 font-mono text-[11px] text-faint">
              {billing.stripeReady
                ? "Stripe checkout is connected."
                : "STRIPE_SECRET_KEY + STRIPE_PRICE_STARTER to take payments."}
            </p>
          </div>
          {billing.tier === "trial_5" ? (
            <Button
              tone="accent"
              onClick={() =>
                emitPaywall({
                  code: "TRIAL_LIMIT_REACHED",
                  message: "Continue testing winning products without interruption.",
                  used: billing.productsUsed,
                  limit: billing.productsLimit,
                  resource: "products",
                })
              }
            >
              Upgrade
            </Button>
          ) : null}
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {connections.map((c) => (
          <Card key={c.name} className="p-5">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-sm font-semibold">{c.name}</h2>
              <Badge tone={c.ok ? "profit" : "line"}>{c.ok ? "Connected" : "Needs you"}</Badge>
            </div>
            <p className="mt-2 text-sm text-muted">{c.why}</p>
            <p className="mt-3 font-mono text-[11px] text-faint">{c.need}</p>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader title="Operator defaults" eyebrow="This store" />
        <form
          className="grid gap-4 p-5 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              await saveOperatorSettings(form);
              setMsg("Saved.");
            });
          }}
        >
          <Field label="Display name">
            <input
              className={inputClass}
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            />
          </Field>
          <Field label="Store name">
            <input
              className={inputClass}
              value={form.storeName}
              onChange={(e) => setForm({ ...form, storeName: e.target.value })}
            />
          </Field>
          <Field label="Email (Google)">
            <input className={inputClass} value={form.email} readOnly />
          </Field>
          <Field label="Default markup">
            <input
              className={inputClass}
              type="number"
              step="0.1"
              value={form.markupMultiplier}
              onChange={(e) => setForm({ ...form, markupMultiplier: Number(e.target.value) })}
            />
          </Field>
          <Field label="Pause ads after ($)">
            <input
              className={inputClass}
              type="number"
              value={form.spendLimitThreshold}
              onChange={(e) => setForm({ ...form, spendLimitThreshold: Number(e.target.value) })}
            />
          </Field>
          <Field label="Min sales per ad $">
            <input
              className={inputClass}
              type="number"
              step="0.05"
              value={form.minRoasThreshold}
              onChange={(e) => setForm({ ...form, minRoasThreshold: Number(e.target.value) })}
            />
          </Field>
          <Field label="Store timezone">
            <input
              className={inputClass}
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[#5B5FFF]"
              checked={form.daypartingEnabled}
              onChange={(e) => setForm({ ...form, daypartingEnabled: e.target.checked })}
            />
            Dayparting engine — pause ad sets 1:00–6:00 AM store time, resume at 6:00 AM (never wakes killed or manually paused ads)
          </label>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              Save defaults
            </Button>
            {msg ? <span className="ml-3 text-sm text-profit">{msg}</span> : null}
          </div>
        </form>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold">Clear workspace</h2>
        <p className="mt-1 text-sm text-muted">
          Removes catalog, orders, campaigns, and suppliers. Keeps your Google account and store settings.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            tone="loss"
            disabled={pending}
            onClick={() => start(() => resetDemoData())}
          >
            Clear catalog &amp; orders
          </Button>
          <SignOutButton />
        </div>
      </Card>
    </div>
  );
}
