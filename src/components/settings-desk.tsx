"use client";

import { useState, useTransition } from "react";
import { resetDemoData, saveOperatorSettings } from "@/app/actions/settings";
import { Badge, Button, Card, CardHeader, Field, inputClass } from "./ui";

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
}: {
  status: Status;
  user: {
    displayName: string;
    storeName: string;
    email: string;
    markupMultiplier: number;
    spendLimitThreshold: number;
    minRoasThreshold: number;
  };
}) {
  const [pending, start] = useTransition();
  const [form, setForm] = useState(user);
  const [msg, setMsg] = useState("");

  const connections = [
    {
      name: "Shopify Admin API",
      ok: status.shopify,
      need: "SHOPIFY_STORE_DOMAIN + SHOPIFY_ADMIN_TOKEN",
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
      need: "ENABLE_HEADLESS_SCRAPE=true + Playwright + proxies",
      why: "Optional. Official API is preferred. You must supply proxies.",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">Settings</p>
        <h1 className="mt-1 text-2xl font-semibold">Store + integrations</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          The desk is fully usable in demo mode. Paste keys into <code className="font-mono">.env.local</code>{" "}
          (see <code className="font-mono">env.example</code>) — that is the only part I cannot do for you.
        </p>
      </div>

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
          <Field label="Email">
            <input
              className={inputClass}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
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
          <Field label="Ad spend kill cap ($)">
            <input
              className={inputClass}
              type="number"
              value={form.spendLimitThreshold}
              onChange={(e) => setForm({ ...form, spendLimitThreshold: Number(e.target.value) })}
            />
          </Field>
          <Field label="Min ROAS">
            <input
              className={inputClass}
              type="number"
              step="0.05"
              value={form.minRoasThreshold}
              onChange={(e) => setForm({ ...form, minRoasThreshold: Number(e.target.value) })}
            />
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              Save defaults
            </Button>
            {msg ? <span className="ml-3 text-sm text-profit">{msg}</span> : null}
          </div>
        </form>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold">Reset demo data</h2>
        <p className="mt-1 text-sm text-muted">
          Wipes the local SQLite file back to the seeded store. Does not touch Shopify or ads.
        </p>
        <Button
          className="mt-4"
          tone="loss"
          disabled={pending}
          onClick={() => start(() => resetDemoData())}
        >
          Reset seeded catalog
        </Button>
      </Card>
    </div>
  );
}
