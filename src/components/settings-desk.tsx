"use client";

import { useState, useTransition } from "react";
import {
  repairCatalog,
  resetDemoData,
  saveOperatorSettings,
  extendMetaAccessToken,
  disconnectShopify,
} from "@/app/actions/settings";
import { SignOutButton } from "./sign-out-button";
import { Badge, Button, Card, CardHeader, Field, inputClass } from "./ui";
import { PwaInstallButton } from "./pwa-install-button";
import { emitPaywall } from "@/lib/paywall";
import type { BillingSummary } from "@/lib/paywall";

type Status = {
  store?: boolean;
  shopify: boolean;
  meta: boolean;
  metaStatus?: "connected" | "degraded" | "offline";
  metaError?: string | null;
  metaCheckedAt?: string | null;
  tiktok: boolean;
  aliexpress: boolean;
  cj?: boolean;
  serp: boolean;
  ai: boolean;
  aiConfigured?: boolean;
  aiError?: string | null;
  aiModel?: string;
  aiCheckedAt?: string | null;
  scrape: boolean;
  demo: boolean;
  liveCount: number;
};

type ShopifyOAuthProps = {
  connected: boolean;
  domain: string;
  appReady: boolean;
  flash: { tone: "ok" | "err"; message: string } | null;
};

export function SettingsDesk({
  status,
  user,
  billing,
  storefrontUrl = "",
  shopifyOAuth,
  metaLongLived = false,
  canExtendMeta = false,
  metaAppReady = false,
}: {
  status: Status;
  billing: BillingSummary;
  storefrontUrl?: string;
  shopifyOAuth?: ShopifyOAuthProps;
  metaLongLived?: boolean;
  canExtendMeta?: boolean;
  metaAppReady?: boolean;
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
  const [msg, setMsg] = useState(shopifyOAuth?.flash?.message || "");
  const [shopInput, setShopInput] = useState(shopifyOAuth?.domain || "");

  const [clearConfirm, setClearConfirm] = useState("");

  const connections = [
    {
      name: "Your store",
      ok: true,
      why: "Included. Publish a product and it goes live at /store. Shoppers pay with Stripe — no Shopify bill.",
      href: "/store",
      hrefLabel: "Open store",
    },
    {
      name: "Shopify",
      ok: status.shopify,
      why: shopifyOAuth?.connected
        ? `Optional leftover: connected as ${shopifyOAuth.domain}.myshopify.com.`
        : "Optional. You do not need Shopify — your Seto store is included.",
      href: storefrontUrl || undefined,
      hrefLabel: storefrontUrl ? "Open Shopify storefront" : undefined,
      shopifyConnect: true as const,
    },
    {
      name: "Meta ads",
      ok: status.metaStatus === "connected",
      degraded: status.metaStatus === "degraded",
      why:
        status.metaStatus === "connected"
          ? `Live ad account check passed${status.metaCheckedAt ? ` · checked ${new Date(status.metaCheckedAt).toLocaleString()}` : ""}.`
          : status.metaStatus === "degraded"
            ? status.metaError ||
              "Token present but Guard cannot protect spend yet — finish Meta setup (account ID + long-lived token)."
            : "Reads spend and can pause Facebook and Instagram ads that are losing money.",
      metaExtend: Boolean(status.meta || metaLongLived || status.metaStatus === "degraded"),
    },
    {
      name: "TikTok ads",
      ok: status.tiktok,
      why: "Reads spend and can pause TikTok ads that are losing money.",
    },
    {
      name: "AliExpress",
      ok: status.aliexpress,
      why: status.aliexpress
        ? "Live Discover search + Open API catalog enrich when you import."
        : "Needs ALIEXPRESS_APP_KEY + SECRET on Railway for Open API enrich. Public HTML Discover still works without them.",
    },
    {
      name: "CJ Dropshipping",
      ok: Boolean(status.cj),
      why: status.cj
        ? "Second live supplier catalog + paste-URL import."
        : "Optional. Add CJ_API_KEY on Railway to search CJ and import CJ product URLs.",
    },
    {
      name: "SerpApi (visual match)",
      ok: status.serp,
      why: status.serp
        ? "Google Lens reverse image search is live on Discover."
        : "Used on Discover for competitor creative reverse search. Add SERPAPI_KEY on Railway.",
    },
    {
      name: "Listing copy",
      ok: status.ai,
      why: status.ai
        ? `Title and ad-angle rewrite is live${status.aiCheckedAt ? ` · checked ${new Date(status.aiCheckedAt).toLocaleString()}` : ""}.`
        : status.aiConfigured
          ? `Key is set but the copy service failed a health check${status.aiError ? ` (${status.aiError})` : ""}. Offline benefit copy still runs.`
          : "Offline benefit-based copy runs today. Add the copy API key on Railway to turn on live rewrites.",
    },
    {
      name: "Listing import",
      ok: status.scrape,
      readyLabel: true,
      why: "Pulls photos and price when you paste a supplier URL. If the official catalog is blocked, the desk reads the listing page instead.",
    },
    {
      name: "Billing",
      ok: billing.stripeReady,
      readyLabel: true,
      why: "Takes the Starter or Scaler upgrade after the free trial.",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">Settings</p>
        <h1 className="mt-1 text-xl font-semibold sm:text-2xl">Store + integrations</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Connected means that account is live ({status.liveCount} live APIs in the sidebar). Listing import and
          Billing use Ready / Needs you and are not counted as live APIs.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href="/store" className="inline-flex min-h-11 items-center rounded-xl border border-line px-3.5 py-2 text-sm">
            Open your store
          </a>
          <PwaInstallButton />
        </div>
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">Plan</p>
            <h2 className="mt-1 text-sm font-semibold">{billing.label}</h2>
            <p className="mt-2 text-sm text-muted">
              {Number.isFinite(billing.productsLimit)
                ? `${billing.productsUsed} / ${billing.productsLimit} product imports`
                : `${billing.productsUsed} product imports (unlimited)`}
              {billing.period === "month" ? " this month" : " on this trial"}. Lens{" "}
              {Number.isFinite(billing.lensLimit)
                ? `${billing.lensUsed} / ${billing.lensLimit}`
                : `${billing.lensUsed} / ∞`}
              . Margin Guard {billing.campaignsUsed} /{" "}
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
              <Badge
                tone={
                  "degraded" in c && c.degraded
                    ? "warn"
                    : c.ok
                      ? "profit"
                      : "line"
                }
              >
                {"readyLabel" in c && c.readyLabel
                  ? c.ok
                    ? "Ready"
                    : "Needs you"
                  : "degraded" in c && c.degraded
                    ? "Needs setup"
                    : c.ok
                      ? "Connected"
                      : "Needs you"}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-muted">{c.why}</p>
            {"shopifyConnect" in c && c.shopifyConnect ? (
              <div className="mt-3 space-y-2">
                {shopifyOAuth?.connected ? (
                  <Button
                    className="h-8 px-3 text-xs"
                    tone="line"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        setMsg("");
                        try {
                          const res = await disconnectShopify();
                          setMsg(res.message);
                          setShopInput("");
                        } catch (e) {
                          setMsg(e instanceof Error ? e.message : "Could not disconnect Shopify.");
                        }
                      })
                    }
                  >
                    Disconnect Shopify
                  </Button>
                ) : shopifyOAuth?.appReady ? (
                  <form
                    className="flex flex-wrap items-end gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const shop = shopInput.trim();
                      if (!shop) {
                        setMsg("Enter your shop name (e.g. my-store).");
                        return;
                      }
                      window.location.href = `/api/shopify/auth?shop=${encodeURIComponent(shop)}`;
                    }}
                  >
                    <label className="min-w-[10rem] flex-1">
                      <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
                        Shop name
                      </span>
                      <input
                        className={inputClass}
                        placeholder="my-store"
                        value={shopInput}
                        onChange={(e) => setShopInput(e.target.value)}
                        autoComplete="off"
                      />
                    </label>
                    <Button type="submit" className="h-10 px-3 text-xs" tone="accent">
                      Connect Shopify
                    </Button>
                  </form>
                ) : (
                  <p className="text-xs text-muted">
                    Connect needs SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET on Railway (Dev Dashboard app), with
                    redirect URI{" "}
                    <span className="font-mono text-[10px]">/api/shopify/callback</span> on that app.
                  </p>
                )}
              </div>
            ) : null}
            {"metaExtend" in c && c.metaExtend ? (
              metaAppReady ? (
                <Button
                  className="mt-3 h-8 px-3 text-xs"
                  tone="line"
                  disabled={pending || !canExtendMeta}
                  onClick={() =>
                    start(async () => {
                      setMsg("");
                      try {
                        const res = await extendMetaAccessToken();
                        setMsg(res.message);
                      } catch (e) {
                        setMsg(e instanceof Error ? e.message : "Could not extend Meta token.");
                      }
                    })
                  }
                >
                  Extend Meta token (~60d)
                </Button>
              ) : (
                <p className="mt-3 text-xs text-muted">
                  Extend Meta token is hidden until META_APP_ID and META_APP_SECRET are set on Railway (App
                  settings → Basic).
                </p>
              )
            ) : null}
            {"href" in c && c.href ? (
              <a href={c.href} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs text-accent">
                {c.hrefLabel ?? "Open"} →
              </a>
            ) : null}
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
            {msg ? (
              <span
                className={`ml-3 text-sm ${
                  /fail|could not|add meta|error|no meta/i.test(msg) ? "text-loss" : "text-profit"
                }`}
              >
                {msg}
              </span>
            ) : null}
          </div>
        </form>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold">Repair catalog data</h2>
        <p className="mt-1 text-sm text-muted">
          Caps fake ~99k stock figures, fixes unlabeled “Option” variants, and aligns sell prices to your
          markup. Safe to run anytime.
        </p>
        <Button
          className="mt-4"
          tone="line"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await repairCatalog();
              setMsg(
                `Repaired ${result.variantsFixed} variants, ${result.productsPriced} prices, linked ${result.suppliersLinked} suppliers.`,
              );
            })
          }
        >
          Repair catalog
        </Button>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold">Clear workspace</h2>
        <p className="mt-1 text-sm text-muted">
          Removes catalog, orders, campaigns, and suppliers. Keeps your Google account and store settings.
          Type <span className="font-mono text-ink">{user.storeName}</span> to confirm.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <Field label="Confirm store name">
            <input
              className={inputClass}
              value={clearConfirm}
              onChange={(e) => setClearConfirm(e.target.value)}
              placeholder={user.storeName}
            />
          </Field>
          <Button
            tone="loss"
            disabled={pending || clearConfirm.trim() !== user.storeName.trim()}
            onClick={() =>
              start(async () => {
                await resetDemoData();
                setClearConfirm("");
                setMsg("Workspace cleared.");
              })
            }
          >
            Clear catalog &amp; orders
          </Button>
          <SignOutButton />
        </div>
      </Card>
    </div>
  );
}
