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
      name: "Shopify",
      ok: status.shopify,
      why: "Publishes products to your store and brings new checkouts into Orders.",
    },
    {
      name: "Meta ads",
      ok: status.meta,
      why: "Reads spend and can pause Facebook and Instagram ads that are losing money.",
    },
    {
      name: "TikTok ads",
      ok: status.tiktok,
      why: "Reads spend and can pause TikTok ads that are losing money.",
    },
    {
      name: "AliExpress",
      ok: status.aliexpress,
      why: "Finds live supplier listings when you search on Discover.",
    },
    {
      name: "Visual match",
      ok: status.serp,
      why: "Finds a supplier listing from a competitor ad photo.",
    },
    {
      name: "AI copy",
      ok: status.ai,
      why: "Rewrites wholesale titles into storefront copy.",
    },
    {
      name: "Listing import",
      ok: status.scrape,
      why: "Pulls photos and price when you paste a supplier URL. If the official catalog is blocked, the desk reads the listing page instead and writes that to Command activity.",
    },
    {
      name: "Billing",
      ok: billing.stripeReady,
      why: "Takes the Starter or Scaler upgrade after the free trial.",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">Settings</p>
        <h1 className="mt-1 text-xl font-semibold sm:text-2xl">Store + integrations</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Connected means that account is live. Needs you means it still has to be linked by whoever set up the
          store — you do not paste keys on this page.
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
            <p className="mt-2 text-xs text-faint">
              {billing.stripeReady ? "Upgrade checkout is ready." : "Upgrade checkout is not connected yet."}
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
