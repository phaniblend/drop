"use client";

import { useState, useTransition } from "react";
import {
  repairCatalog,
  resetDemoData,
  saveOperatorSettings,
  extendMetaAccessToken,
  disconnectShopify,
  saveMarginGuardMode,
  saveTikTokCredentials,
} from "@/app/actions/settings";
import { SignOutButton } from "./sign-out-button";
import { Badge, Button, Card, CardHeader, Field, inputClass } from "./ui";
import { PwaInstallButton } from "./pwa-install-button";
import { emitPaywall } from "@/lib/paywall";
import type { BillingSummary } from "@/lib/paywall";
import { friendlyMetaError } from "@/lib/meta-status";
import { StripeKeysForm } from "./stripe-keys-form";
import { BillingPortalButton } from "./billing-portal-button";
import { MetaAdAccountPicker } from "./meta-ad-account-picker";
import { GoLiveCard } from "./go-live-card";

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

type MetaOAuthProps = {
  connected: boolean;
  flash: { tone: "ok" | "err"; message: string } | null;
};

export function SettingsDesk({
  status,
  user,
  billing,
  storefrontUrl = "",
  storeHref = "/store",
  shopifyOAuth,
  metaLongLived = false,
  canExtendMeta = false,
  metaAppReady = false,
  metaOAuth,
  guardMode = "ALERT_ONLY",
  metaAccounts = [],
  stripeKeys,
  goLive = null,
  isSuperuser = false,
}: {
  status: Status;
  billing: BillingSummary;
  storefrontUrl?: string;
  storeHref?: string;
  shopifyOAuth?: ShopifyOAuthProps;
  metaLongLived?: boolean;
  canExtendMeta?: boolean;
  metaAppReady?: boolean;
  metaOAuth?: MetaOAuthProps;
  guardMode?: "OFF" | "ALERT_ONLY" | "AUTO_PAUSE";
  metaAccounts?: Array<{ id: string; name: string; currency: string; guardEnabled?: boolean }>;
  stripeKeys?: { publishableMasked: string; secretMasked: string; mode: "off" | "test" | "live" };
  goLive?: {
    softLaunchOk: boolean;
    chargeOk: boolean;
    checks: Array<{
      id: string;
      label: string;
      ok: boolean;
      detail: string;
      owner: "ready" | "railway" | "meta" | "you";
    }>;
    metaReviewUrls: {
      privacy: string;
      terms: string;
      oauthRedirect: string;
      dataDeletion: string;
    };
  } | null;
  isSuperuser?: boolean;
  user: {
    displayName: string;
    storeName: string;
    email: string;
    markupMultiplier: number;
    spendLimitThreshold: number;
    minRoasThreshold: number;
    timezone: string;
    daypartingEnabled: boolean;
    supportEmail: string;
    businessAddress: string;
    metaPixelId: string;
  };
}) {
  const [pending, start] = useTransition();
  const [form, setForm] = useState(user);
  const [msg, setMsg] = useState(shopifyOAuth?.flash?.message || metaOAuth?.flash?.message || "");
  const [shopInput, setShopInput] = useState(shopifyOAuth?.domain || "");
  const [mode, setMode] = useState(guardMode);
  const [consentAuto, setConsentAuto] = useState(false);
  const [tiktokToken, setTiktokToken] = useState("");
  const [tiktokAdv, setTiktokAdv] = useState("");
  const [metaExtendMsg, setMetaExtendMsg] = useState("");

  const [clearConfirm, setClearConfirm] = useState("");
  const [repairMsg, setRepairMsg] = useState("");
  const [previewOperator, setPreviewOperator] = useState(false);
  const operatorView = !isSuperuser || previewOperator;

  const connections = [
    {
      name: "Your store",
      ok: true,
      why: `Included. Publish a product and it goes live at ${storeHref}. Shoppers pay with Stripe — no Shopify bill.`,
      href: storeHref,
      hrefLabel: "Open store",
    },
    {
      name: "Shopify",
      ok: Boolean(shopifyOAuth?.connected),
      why: shopifyOAuth?.connected
        ? `Connected as ${shopifyOAuth.domain}.myshopify.com. Optional — you do not need Shopify to sell.`
        : "Optional. You do not need Shopify — your Seto store is included.",
      href: shopifyOAuth?.connected ? storefrontUrl || undefined : undefined,
      hrefLabel: shopifyOAuth?.connected && storefrontUrl ? "Open Shopify storefront" : undefined,
      shopifyConnect: true as const,
    },
    {
      name: "Meta ads",
      ok: status.metaStatus === "connected" || Boolean(metaOAuth?.connected),
      degraded: status.metaStatus === "degraded",
      why:
        status.metaStatus === "connected" || metaOAuth?.connected
          ? `Live ad account check passed${status.metaCheckedAt ? ` · checked ${new Date(status.metaCheckedAt).toLocaleString()}` : ""}.`
          : status.metaStatus === "degraded"
            ? friendlyMetaError(status.metaError) ||
              "Token expired or incomplete. Use Connect with Facebook or Reconnect Meta on this card."
            : "Reads spend and can pause Facebook and Instagram ads that are losing money.",
      metaLogin: true as const,
      metaExtend: Boolean(status.meta || metaLongLived || status.metaStatus === "degraded" || metaOAuth?.connected),
      reconnectMeta: status.metaStatus !== "connected" && !metaOAuth?.connected,
    },
    {
      name: "TikTok ads",
      ok: status.tiktok,
      why: status.tiktok
        ? "Reads spend and can pause TikTok ads that are losing money."
        : "Paste a Marketing API access token and advertiser id to connect your own TikTok ads account.",
      tiktokConnect: true as const,
    },
    {
      name: "AliExpress",
      ok: status.aliexpress,
      why: status.aliexpress
        ? "Live Discover search + Open API catalog enrich when you import."
        : "Public search works. Official catalog enrich needs AliExpress app keys in Settings on this desk.",
    },
    ...(status.cj
      ? [
          {
            name: "CJ Dropshipping",
            ok: true,
            why: "Second live supplier catalog + paste-URL import.",
          },
        ]
      : []),
    ...(status.serp
      ? [
          {
            name: "SerpApi (visual match)",
            ok: true,
            why: "Google Lens reverse image search is live on Discover.",
          },
        ]
      : []),
    {
      name: "Listing copy",
      ok: status.ai,
      why: status.ai
        ? `Title and ad-angle rewrite is live${status.aiCheckedAt ? ` · checked ${new Date(status.aiCheckedAt).toLocaleString()}` : ""}.`
        : status.aiConfigured
          ? `Key is set but the copy service failed a health check${status.aiError ? ` (${status.aiError})` : ""}. Offline benefit copy still runs.`
          : "Offline benefit-based copy runs today.",
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

  const shownConnections = !operatorView
    ? connections
    : connections.filter(
        (c) =>
          c.name === "Your store" ||
          c.name === "Meta ads" ||
          c.name === "TikTok ads" ||
          (c.name === "Shopify" && shopifyOAuth?.connected),
      );

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">Settings</p>
        <h1 className="mt-1 text-xl font-semibold sm:text-2xl">
          {operatorView ? "Your store" : "Store + integrations"}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          {operatorView
            ? "Your shop, checkout keys, ads, and how Guard should pause losers. Seto already runs suppliers and listing copy."
            : `Connected means that account is live (${status.liveCount} live APIs in the sidebar). Listing import and Billing use Ready / Needs you and are not counted as live APIs.`}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href={storeHref} className="inline-flex min-h-11 items-center rounded-xl border border-line px-3.5 py-2 text-sm">
            Open your store
          </a>
          <PwaInstallButton />
          {isSuperuser ? (
            <Button tone="line" className="h-11" onClick={() => setPreviewOperator((v) => !v)}>
              {previewOperator ? "Show platform tools" : "Preview operator view"}
            </Button>
          ) : null}
        </div>
      </div>

      {!operatorView && goLive ? (
        <GoLiveCard
          softLaunchOk={goLive.softLaunchOk}
          chargeOk={goLive.chargeOk}
          checks={goLive.checks}
          metaReviewUrls={goLive.metaReviewUrls}
        />
      ) : null}

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">Plan</p>
            <h2 className="mt-1 text-sm font-semibold">{billing.label}</h2>
            <p className="mt-2 text-sm text-muted">
              {Number.isFinite(billing.productsLimit)
                ? `${billing.productsUsed} / ${billing.productsLimit} product imports`
                : `${billing.productsUsed} product imports (unlimited)`}
              {billing.period === "month" ? " this month" : " on this trial"}. Margin Guard{" "}
              {billing.campaignsUsed} /{" "}
              {Number.isFinite(billing.campaignsLimit) ? billing.campaignsLimit : "∞"} campaigns.
            </p>
            <p className="mt-2 text-xs text-faint">
              {billing.health?.liveReady
                ? "Live subscription checkout is ready."
                : billing.health?.testReady
                  ? "Stripe is in test mode — upgrades will not take real cards."
                  : "Subscription checkout is not connected yet."}
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-2">
          <a href="/pricing" className="text-xs text-accent">
            View plan comparison →
          </a>
          {billing.hasCustomer ? <BillingPortalButton /> : null}
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
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {shownConnections.map((c) => (
          <Card key={c.name} id={c.name === "Meta ads" ? "meta" : undefined} className="p-5">
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
                    Shopify Connect is optional. You can sell on your Seto store without it.
                  </p>
                )}
              </div>
            ) : null}
            {"reconnectMeta" in c && c.reconnectMeta ? (
              <p className="mt-3 text-xs font-medium text-loss">
                {friendlyMetaError(status.metaError)}
              </p>
            ) : null}
            {"metaLogin" in c && c.metaLogin ? (
              <div id="meta" className="mt-3 flex flex-wrap items-center gap-2">
                {metaAppReady ? (
                  <a href="/api/meta/auth">
                    <Button type="button" className="h-8 px-3 text-xs" tone="accent" disabled={pending}>
                      {metaOAuth?.connected || status.metaStatus === "connected"
                        ? "Reconnect with Facebook"
                        : "Connect with Facebook"}
                    </Button>
                  </a>
                ) : (
                  <p className="text-xs text-muted">
                    Meta Login needs META_APP_ID and META_APP_SECRET on the host.
                  </p>
                )}
                {metaOAuth?.flash ? (
                  <p className={`text-xs ${metaOAuth.flash.tone === "ok" ? "text-profit" : "text-loss"}`}>
                    {metaOAuth.flash.message}
                  </p>
                ) : null}
                {metaAccounts.length ? (
                  <MetaAdAccountPicker
                    accounts={metaAccounts}
                    selectedId={metaAccounts.find((a) => a.guardEnabled)?.id || metaAccounts[0]?.id || ""}
                  />
                ) : null}
                <p className="mt-2 text-[11px] text-faint">
                  Seto can read ad spend and pause ad sets you allow. Disconnect anytime with Reconnect → revoke in
                  Facebook, or contact support to clear the desk token.
                </p>
              </div>
            ) : null}
            {"metaExtend" in c && c.metaExtend && status.metaStatus === "connected" ? (
              metaAppReady ? (
                <div className="mt-3 space-y-1">
                  <Button
                    className="h-8 px-3 text-xs"
                    tone="line"
                    disabled={pending || !canExtendMeta}
                    onClick={() =>
                      start(async () => {
                        setMetaExtendMsg("");
                        try {
                          const res = await extendMetaAccessToken();
                          setMetaExtendMsg(res.message);
                          setMsg(res.message);
                        } catch (e) {
                          const text = e instanceof Error ? e.message : "Could not extend Meta token.";
                          setMetaExtendMsg(text);
                          setMsg(text);
                        }
                      })
                    }
                  >
                    {pending ? "Extending…" : "Extend Meta token (~60d)"}
                  </Button>
                  {metaExtendMsg ? <p className="text-xs text-muted">{metaExtendMsg}</p> : null}
                </div>
              ) : null
            ) : null}
            {"tiktokConnect" in c && c.tiktokConnect && !c.ok ? (
              <form
                className="mt-3 space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  start(async () => {
                    setMsg("");
                    try {
                      const res = await saveTikTokCredentials({
                        accessToken: tiktokToken,
                        advertiserId: tiktokAdv,
                      });
                      setMsg(res.message);
                      setTiktokToken("");
                    } catch (err) {
                      setMsg(err instanceof Error ? err.message : "Could not save TikTok.");
                    }
                  });
                }}
              >
                <input
                  className={inputClass}
                  placeholder="TikTok Marketing API access token"
                  value={tiktokToken}
                  onChange={(e) => setTiktokToken(e.target.value)}
                  autoComplete="off"
                />
                <input
                  className={inputClass}
                  placeholder="Advertiser id"
                  value={tiktokAdv}
                  onChange={(e) => setTiktokAdv(e.target.value)}
                  autoComplete="off"
                />
                <Button type="submit" className="h-8 px-3 text-xs" tone="accent" disabled={pending}>
                  Connect TikTok
                </Button>
              </form>
            ) : null}
            {"href" in c && c.href ? (
              <a href={c.href} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs text-accent">
                {c.hrefLabel ?? "Open"} →
              </a>
            ) : null}
          </Card>
        ))}
      </div>

      {stripeKeys ? (
        <StripeKeysForm
          publishableMasked={stripeKeys.publishableMasked}
          secretMasked={stripeKeys.secretMasked}
          mode={stripeKeys.mode}
        />
      ) : null}

      <Card id="margin-guard">
        <CardHeader title="Margin Guard mode" eyebrow="Ads & Guard" />
        <div className="space-y-4 p-5">
          <p className="text-sm text-muted">
            Guard reads Meta (or TikTok) spend and matches contribution from your Seto store orders — or Shopify if
            you connect it. Runs hourly. Choose alert-only or auto-pause.
          </p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["OFF", "Off"],
                ["ALERT_ONLY", "Alert only"],
                ["AUTO_PAUSE", "Auto-pause"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                  mode === value
                    ? "border-accent bg-accent/10 text-ink"
                    : "border-line text-muted hover:border-ink/30"
                }`}
                onClick={() => setMode(value)}
              >
                {label}
              </button>
            ))}
          </div>
          {mode === "AUTO_PAUSE" ? (
            <label className="flex items-start gap-2 text-sm text-muted">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-[#5B5FFF]"
                checked={consentAuto || guardMode === "AUTO_PAUSE"}
                onChange={(e) => setConsentAuto(e.target.checked)}
              />
              <span>
                I understand Seto may pause Meta ad sets that fail dual-signal checks. I can turn this off anytime.
              </span>
            </label>
          ) : null}
          <Button
            tone="accent"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setMsg("");
                try {
                  const res = await saveMarginGuardMode({
                    mode,
                    consentAutoPause: consentAuto || guardMode === "AUTO_PAUSE",
                  });
                  setMode(res.mode as "OFF" | "ALERT_ONLY" | "AUTO_PAUSE");
                  setMsg(res.message);
                } catch (e) {
                  setMsg(e instanceof Error ? e.message : "Could not save Guard mode.");
                }
              })
            }
          >
            Save Guard mode
          </Button>
        </div>
      </Card>

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
          <Field label="Shopper support email">
            <input
              className={inputClass}
              type="email"
              value={form.supportEmail}
              onChange={(e) => setForm({ ...form, supportEmail: e.target.value })}
              placeholder={form.email}
            />
          </Field>
          <Field label="Business address">
            <input
              className={inputClass}
              value={form.businessAddress}
              onChange={(e) => setForm({ ...form, businessAddress: e.target.value })}
              placeholder="Shown on the store contact page"
            />
          </Field>
          <Field label="Meta Pixel ID">
            <input
              className={inputClass}
              value={form.metaPixelId}
              onChange={(e) => setForm({ ...form, metaPixelId: e.target.value })}
              placeholder="Digits only — used on your public store"
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
          <Field label="Pause ads after ($)">
            <input
              className={inputClass}
              type="number"
              value={form.spendLimitThreshold}
              onChange={(e) => setForm({ ...form, spendLimitThreshold: Number(e.target.value) })}
            />
          </Field>
          <Field label="Min ROAS (sales per $1 ad)">
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
            Quiet hours (dayparting) — pause ad sets 1:00–6:00 AM store time, resume at 6:00 AM (never wakes killed or manually paused ads)
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

      {!operatorView ? (
      <Card className="p-5">
        <h2 className="text-sm font-semibold">Repair catalog data</h2>
        <p className="mt-1 text-sm text-muted">
          Caps fake ~99k stock figures and fixes unlabeled “Option” variants. It does not change prices
          you already set.
        </p>
        <Button
          className="mt-4"
          tone="line"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await repairCatalog();
              setRepairMsg(
                `Repaired ${result.variantsFixed} variants, cleaned ${result.titlesFixed ?? 0} titles, added ${result.suppliersLinked} suppliers.`,
              );
            })
          }
        >
          Repair catalog
        </Button>
        {repairMsg ? <p className="mt-3 text-sm text-profit">{repairMsg}</p> : null}
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
      ) : (
        <div>
          <SignOutButton />
        </div>
      )}
    </div>
  );
}
