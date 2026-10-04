"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  applyCopySuggestion,
  rewriteProductCopy,
  setProductStatus,
} from "@/app/actions/products";
import { postJson } from "@/lib/retry-fetch";
import { money, pct } from "@/lib/utils";
import { unitMargin, breakevenRoas } from "@/lib/money";
import { deliveryWindow } from "@/lib/delivery";
import { MIN_PUBLISH_PRICE, screenListing } from "@/lib/product-screen";
import { sanitizeShopperHtml } from "@/lib/shopper-copy";
import { humanizeVariantLabel, labeledVariantName } from "@/lib/variant-label";
import { Button, Card, CardHeader, Field, inputClass } from "./ui";
import { StatusPill } from "./status-pill";
import { Thumb } from "./thumb";
import type { CampaignTracker, Product, ProductVariant } from "@/lib/db/schema";
import { AdHooksPanel } from "./ad-hooks-panel";
import { RemoveProductButton } from "./remove-product-button";

type Economics = { cogs: number; fee: number; profit: number; margin: number };

export function ProductEditor({
  product,
  storefrontHomeUrl = "",
  storeHref = "/store",
}: {
  product: Product & {
    variants: ProductVariant[];
    campaigns: CampaignTracker[];
    economics: Economics;
  };
  storefrontHomeUrl?: string;
  storeHref?: string;
}) {
  const router = useRouter();
  const [savingPrice, startPrice] = useTransition();
  const [rewriting, startRewrite] = useTransition();
  const [publishing, startPublish] = useTransition();
  const [statusPending, startStatus] = useTransition();
  const baseCost = product.variants[0]?.variantCost ?? product.baseCost;
  const initialShip = Number(product.shippingCost) || 0;
  const initialLanded = baseCost + (initialShip > 0 ? initialShip : 0);
  const [retail, setRetail] = useState(String(product.retailPrice));
  const [markup, setMarkup] = useState(() => {
    if (initialLanded > 0 && product.retailPrice > 0) {
      return (product.retailPrice / initialLanded).toFixed(2);
    }
    return String(product.markupMultiplier);
  });
  const [shipping, setShipping] = useState(String(product.shippingCost));
  const [copyReason, setCopyReason] = useState("");
  const [suggestion, setSuggestion] = useState<{ title: string; descriptionHtml: string } | null>(null);
  const [publishMsg, setPublishMsg] = useState<{ tone: "profit" | "warn" | "loss"; text: string; href?: string } | null>(
    null,
  );
  const [priceMsg, setPriceMsg] = useState("");
  const [copyMsg, setCopyMsg] = useState("");
  const [showSupplier, setShowSupplier] = useState(false);
  const [allowUnknownShipping, setAllowUnknownShipping] = useState(false);
  const [allowRestricted, setAllowRestricted] = useState(false);
  const shipNum = Number(shipping) || 0;
  const landedCost = baseCost + (shipNum > 0 ? shipNum : 0);
  const retailNum = Number(retail) || 0;
  const liveEcon = unitMargin(retailNum, baseCost, shipNum);
  const beRoas = breakevenRoas(retailNum, baseCost, shipNum);
  const shipUnknown = shipNum <= 0;

  function onRetailChange(value: string) {
    setRetail(value);
    const price = Number(value);
    if (landedCost > 0 && Number.isFinite(price) && price > 0) {
      setMarkup((price / landedCost).toFixed(2));
    }
  }

  function onMarkupChange(value: string) {
    setMarkup(value);
    const m = Number(value);
    if (landedCost > 0 && Number.isFinite(m) && m > 0) {
      setRetail((landedCost * m).toFixed(2));
    }
  }

  function runPublish() {
    startPublish(async () => {
      const screen = screenListing({
        title: `${product.cleanTitle ?? ""} ${product.rawTitle}`,
        description: product.descriptionHtml ?? "",
      });
      if (!screen.ok && screen.level === "block") {
        setPublishMsg({ tone: "loss", text: screen.reason });
        return;
      }
      if (!screen.ok && screen.level === "review" && !allowRestricted) {
        setPublishMsg({ tone: "warn", text: `${screen.reason} Check the box to publish anyway.` });
        return;
      }
      if (shipUnknown && !allowUnknownShipping) {
        setPublishMsg({
          tone: "warn",
          text: "Enter ship cost, or check the box to publish with shipping unknown.",
        });
        requestAnimationFrame(() => {
          document.getElementById("ship-cost")?.scrollIntoView({ behavior: "smooth", block: "center" });
          document.getElementById("ship-cost")?.focus();
        });
        return;
      }
      const sellable = product.variants.reduce((s, v) => s + Math.max(0, v.inventoryCount), 0);
      if (sellable <= 0) {
        setPublishMsg({
          tone: "loss",
          text: "No variant has stock. Fix stock before publishing — shoppers would have nothing to buy.",
        });
        return;
      }
      if (retailNum > 0 && retailNum < MIN_PUBLISH_PRICE) {
        setPublishMsg({
          tone: "warn",
          text: `Price under $${MIN_PUBLISH_PRICE.toFixed(2)} rarely covers ads. Raise it before publishing.`,
        });
        return;
      }
      setPublishMsg({ tone: "warn", text: "Publishing to your store…" });
      try {
        const res = await postJson<{
          storeUrl?: string;
          storefrontUrl?: string;
          firstShop?: boolean;
        }>("/api/catalog/publish", {
          productId: product.id,
          allowUnknownShipping,
          allowRestricted,
        });
        setPublishMsg({
          tone: "profit",
          text: res.firstShop
            ? "Your shop is open. This product is live."
            : "Live on your Seto store.",
          href: res.storeUrl || res.storefrontUrl || `/store/${product.id}`,
        });
        router.refresh();
      } catch (e) {
        setPublishMsg({
          tone: "loss",
          text: e instanceof Error ? e.message : "Publish failed. Product stays Draft.",
        });
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">Product</p>
          <h1 className="mt-1 text-2xl font-semibold">{product.cleanTitle ?? product.rawTitle}</h1>
          <p className="mt-1 max-w-xl text-sm text-muted">{product.rawTitle}</p>
          <a href={storeHref} className="mt-2 inline-block text-xs text-accent">
            Open your store →
          </a>
        </div>
        <StatusPill value={product.status} />
      </div>

      {publishMsg ? (
        <p
          className={`rounded-xl border px-3 py-2 text-sm ${
            publishMsg.tone === "profit"
              ? "border-profit/30 bg-profit/5 text-profit"
              : publishMsg.tone === "loss"
                ? "border-loss/30 bg-loss/5 text-loss"
                : "border-warn/30 bg-warn/5 text-warn"
          }`}
        >
          {publishMsg.text}
          {publishMsg.href ? (
            <>
              {" "}
              <a href={publishMsg.href} target="_blank" rel="noreferrer" className="underline">
                Open store page
              </a>
            </>
          ) : null}
        </p>
      ) : null}

      <AdHooksPanel
        productId={product.id}
        title={product.cleanTitle ?? product.rawTitle}
        description={product.descriptionHtml ?? ""}
        price={product.retailPrice}
        productUrl={
          typeof window !== "undefined"
            ? `${window.location.origin}${storeHref.replace(/\/$/, "")}/${product.id}`
            : `${storeHref.replace(/\/$/, "")}/${product.id}`
        }
        initialHooks={(() => {
          try {
            const raw = (product as { adAnglesJson?: string | null }).adAnglesJson;
            if (!raw) return [];
            return JSON.parse(raw) as Array<{ id: string; label: string; hook: string; script: string }>;
          } catch {
            return [];
          }
        })()}
      />

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="overflow-hidden">
          <Thumb src={product.imageUrl} alt="" className="h-72 w-full rounded-none" />
          <div className="space-y-3 p-5">
            <p className="text-xs uppercase tracking-wider text-faint">Storefront copy (live)</p>
            {(() => {
              const title = product.cleanTitle || product.rawTitle;
              const raw = (product.descriptionHtml ?? "").trim();
              const liveHtml = sanitizeShopperHtml(raw, title);
              const claimsStripped = /alleviate|spinal|discomfort|fda|pain relief|cure|treat/i.test(raw);
              return (
                <>
                  {claimsStripped ? (
                    <p className="text-xs text-warn">
                      Same text shoppers see. Health-style claims were removed so ads and the store stay safer.
                    </p>
                  ) : null}
                  <div
                    className="prose-sm text-sm text-muted [&_li]:ml-4 [&_li]:list-disc [&_p]:mb-2"
                    dangerouslySetInnerHTML={{ __html: liveHtml }}
                  />
                </>
              );
            })()}
            <Button
              tone="line"
              disabled={rewriting}
              aria-busy={rewriting}
              onClick={() =>
                startRewrite(async () => {
                  setCopyMsg("");
                  setCopyReason("");
                  setSuggestion(null);
                  try {
                    const copy = await rewriteProductCopy(product.id);
                    if (copy.mode === "local") {
                      setSuggestion({ title: copy.title, descriptionHtml: copy.descriptionHtml });
                      setCopyReason(
                        copy.reason
                          ? "Couldn’t refresh copy automatically — review this suggestion."
                          : "Review this suggestion before applying.",
                      );
                      setCopyMsg("");
                    } else {
                      setCopyMsg("Title and bullets updated.");
                      router.refresh();
                    }
                  } catch {
                    setCopyMsg("Could not rewrite. Try again.");
                  }
                })
              }
            >
              {rewriting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {rewriting ? "Rewriting…" : "Rewrite title & bullets"}
            </Button>
            {rewriting ? (
              <div className="space-y-2" aria-hidden>
                <div className="h-8 animate-pulse rounded-lg bg-surface-2" />
                <div className="h-16 animate-pulse rounded-lg bg-surface-2" />
              </div>
            ) : null}
            {copyReason ? <p className="text-xs text-warn">{copyReason}</p> : null}
            {suggestion ? (
              <div className="rounded-xl border border-warn/30 bg-warn/5 p-3 space-y-2">
                <p className="text-xs uppercase tracking-wider text-faint">Suggested title</p>
                <p className="text-sm font-semibold">{suggestion.title}</p>
                <div
                  className="prose-sm text-xs text-muted [&_li]:ml-4 [&_li]:list-disc"
                  dangerouslySetInnerHTML={{ __html: suggestion.descriptionHtml }}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    tone="accent"
                    disabled={rewriting}
                    onClick={() =>
                      startRewrite(async () => {
                        await applyCopySuggestion(product.id, suggestion);
                        setSuggestion(null);
                        setCopyReason("");
                        setCopyMsg("Suggestion applied.");
                        router.refresh();
                      })
                    }
                  >
                    Apply
                  </Button>
                  <Button
                    tone="ghost"
                    disabled={rewriting}
                    onClick={() => {
                      setSuggestion(null);
                      setCopyReason("");
                      setCopyMsg("Suggestion discarded. Title unchanged.");
                    }}
                  >
                    Discard
                  </Button>
                </div>
              </div>
            ) : null}
            {copyMsg ? <p className="text-xs text-muted">{copyMsg}</p> : null}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <p className="text-xs uppercase tracking-wider text-faint">Cost vs profit</p>
            <dl className="mt-3 grid grid-cols-2 gap-3 font-mono text-sm">
              <div>
                <dt className="text-faint">
                  {shipUnknown ? "Item cost (shipping unknown)" : "Landed cost (item + ship)"}
                </dt>
                <dd>{money(shipUnknown ? baseCost : liveEcon.cogs)}</dd>
              </div>
              <div>
                <dt className="text-faint">Card fee</dt>
                <dd>{money(liveEcon.fee)}</dd>
              </div>
              <div>
                <dt className="text-faint">Profit / unit</dt>
                <dd className="text-profit">{money(liveEcon.profit)}</dd>
              </div>
              <div>
                <dt className="text-faint">Margin</dt>
                <dd>
                  {pct(liveEcon.margin)}
                  {shipUnknown ? (
                    <span className="ml-1 text-[10px] text-warn">est., shipping unknown</span>
                  ) : null}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-faint">Break-even ad cost / sale</dt>
                <dd>{liveEcon.profit > 0 ? money(liveEcon.profit) : "Price does not cover cost + fees"}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-faint">Break-even ROAS</dt>
                <dd>
                  {Number.isFinite(beRoas) && beRoas > 0
                    ? `${beRoas.toFixed(2)}x (Ads Manager target)`
                    : "—"}
                </dd>
              </div>
            </dl>
            <div className="mt-4 grid grid-cols-1 gap-2">
              <Field label="Selling price">
                <input className={inputClass} value={retail} onChange={(e) => onRetailChange(e.target.value)} />
              </Field>
              <Field label={shipUnknown ? "Markup (sell ÷ item cost)" : "Markup (sell ÷ landed cost)"}>
                <input className={inputClass} value={markup} onChange={(e) => onMarkupChange(e.target.value)} />
              </Field>
              <Field label="Ship $">
                <input
                  id="ship-cost"
                  className={`${inputClass} ${shipUnknown && !allowUnknownShipping ? "border-loss/50" : ""}`}
                  value={shipping}
                  onChange={(e) => {
                    const value = e.target.value;
                    setShipping(value);
                    const ship = Number(value) || 0;
                    const landed = baseCost + (ship > 0 ? ship : 0);
                    const price = Number(retail);
                    if (landed > 0 && Number.isFinite(price) && price > 0) {
                      setMarkup((price / landed).toFixed(2));
                    }
                  }}
                />
              </Field>
            </div>
            {shipUnknown ? (
              <p className="mt-2 text-xs text-warn">
                Supplier freight was not available — margin is estimated until you enter ship cost.
              </p>
            ) : null}
            {shipUnknown && !allowUnknownShipping ? (
              <p className="mt-1 text-xs text-loss">
                Enter ship cost above, or check “Publish without a ship cost”, before publishing.
              </p>
            ) : null}
            {shipUnknown ? (
              <label className="mt-2 flex items-center gap-2 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={allowUnknownShipping}
                  onChange={(e) => setAllowUnknownShipping(e.target.checked)}
                />
                Publish without a ship cost
              </label>
            ) : null}
            {(() => {
              const screen = screenListing({
                title: `${product.cleanTitle ?? ""} ${product.rawTitle}`,
                description: product.descriptionHtml ?? "",
              });
              if (screen.ok || screen.level === "block") {
                return screen.level === "block" ? (
                  <p className="mt-2 text-xs text-loss">{screen.reason}</p>
                ) : null;
              }
              return (
                <label className="mt-2 flex items-center gap-2 text-xs text-muted">
                  <input
                    type="checkbox"
                    checked={allowRestricted}
                    onChange={(e) => setAllowRestricted(e.target.checked)}
                  />
                  {screen.reason || "I checked this listing is allowed (health/brand risk)"}
                </label>
              );
            })()}
            {Number.isFinite(beRoas) && beRoas > 2.5 ? (
              <p className="mt-2 text-xs text-warn">
                Break-even ROAS is {beRoas.toFixed(1)}x — hard to advertise profitably. Raise price or cut cost before
                spending on ads.
              </p>
            ) : null}
            <Button
              className="mt-3"
              tone="line"
              disabled={savingPrice}
              onClick={() =>
                startPrice(async () => {
                  setPriceMsg("");
                  try {
                    const saved = await postJson<{
                      ok: boolean;
                      retailPrice: number;
                      markupMultiplier: number;
                      shippingCost: number;
                    }>("/api/catalog/pricing", {
                      productId: product.id,
                      retailPrice: Number(retail),
                      markupMultiplier: Number(markup),
                      shippingCost: Number(shipping),
                    });
                    setRetail(String(saved.retailPrice));
                    setMarkup(String(saved.markupMultiplier));
                    setShipping(String(saved.shippingCost));
                    setPriceMsg("Saved.");
                  } catch {
                    setPriceMsg("Could not save. Try again.");
                    return;
                  }
                  router.refresh();
                })
              }
            >
              {savingPrice ? "Saving…" : "Save pricing"}
            </Button>
            {priceMsg ? (
              <p className={`mt-2 text-xs ${priceMsg === "Saved." ? "text-profit" : "text-loss"}`}>
                {priceMsg}
              </p>
            ) : null}
            <Button className="mt-3 w-full" tone="accent" disabled={publishing} onClick={runPublish}>
              {publishing
                ? product.shopifyProductId
                  ? "Updating…"
                  : "Publishing…"
                : product.status === "published"
                  ? "Update on your store"
                  : "Publish to your store"}
            </Button>
          </Card>
          <Card className="p-5">
            <p className="text-xs uppercase tracking-wider text-faint">Supplier</p>
            <p className="mt-2 text-sm">{product.supplierName}</p>
            <a href={product.supplierUrl} className="mt-1 block truncate text-xs text-accent" target="_blank">
              {product.supplierUrl}
            </a>
            <p className="mt-2 text-xs text-muted">{deliveryWindow(product.shippingDays).text}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {product.status !== "published" && product.status !== "ready" ? (
                <Button
                  tone="line"
                  disabled={statusPending}
                  onClick={() => startStatus(() => setProductStatus(product.id, "ready"))}
                >
                  Mark ready
                </Button>
              ) : null}
              <RemoveProductButton
                productId={product.id}
                productTitle={product.cleanTitle || product.rawTitle}
                label="Remove from catalog"
                tone="ghost"
                redirectTo="/catalog"
              />
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader
          title="Sizes & colors"
          eyebrow="Options"
          action={
            <button
              type="button"
              className="text-xs text-accent"
              onClick={() => setShowSupplier((open) => !open)}
            >
              {showSupplier ? "Hide supplier data" : "Show supplier data"}
            </button>
          }
        />
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-[11px] uppercase tracking-wider text-faint">
            <tr>
              <th className="px-4 py-3">Name</th>
              {showSupplier ? <th className="px-4 py-3">Supplier code</th> : null}
              <th className="px-4 py-3">Cost</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Stock</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {product.variants.map((v, index) => {
              const label = labeledVariantName(v.variantName, index, undefined, {
                sku: v.supplierSkuId,
                cost: v.variantCost,
              });
              return (
                <tr key={v.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Thumb
                        src={v.cleanImageUrl || v.supplierImageUrl || product.imageUrl}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-md"
                      />
                      <span>{label === "Option" ? humanizeVariantLabel(v.variantName) : label}</span>
                    </div>
                  </td>
                  {showSupplier ? <td className="px-4 py-3 font-mono text-xs">{v.supplierSkuId}</td> : null}
                  <td className="px-4 py-3 font-mono text-xs">{money(v.variantCost)}</td>
                  <td className="px-4 py-3 font-mono text-xs">{money(v.variantPrice)}</td>
                  <td className="px-4 py-3 font-mono text-xs">{v.inventoryCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
