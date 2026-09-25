"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  applyCopySuggestion,
  publishProduct,
  rewriteProductCopy,
  setProductStatus,
} from "@/app/actions/products";
import { postJson } from "@/lib/retry-fetch";
import { money, pct } from "@/lib/utils";
import { humanizeVariantLabel, labeledVariantName } from "@/lib/variant-label";
import { Button, Card, CardHeader, Field, inputClass } from "./ui";
import { StatusPill } from "./status-pill";
import { Thumb } from "./thumb";
import type { CampaignTracker, Product, ProductVariant } from "@/lib/db/schema";
import { AdHooksPanel } from "./ad-hooks-panel";

type Economics = { cogs: number; fee: number; profit: number; margin: number };

export function ProductEditor({
  product,
  storefrontHomeUrl = "",
}: {
  product: Product & {
    variants: ProductVariant[];
    campaigns: CampaignTracker[];
    economics: Economics;
  };
  storefrontHomeUrl?: string;
}) {
  const router = useRouter();
  const [savingPrice, startPrice] = useTransition();
  const [rewriting, startRewrite] = useTransition();
  const [publishing, startPublish] = useTransition();
  const [statusPending, startStatus] = useTransition();
  const [retail, setRetail] = useState(String(product.retailPrice));
  const [markup, setMarkup] = useState(String(product.markupMultiplier));
  const [shipping, setShipping] = useState(String(product.shippingCost));
  const baseCost = product.variants[0]?.variantCost ?? product.baseCost;

  function onRetailChange(value: string) {
    setRetail(value);
    const price = Number(value);
    if (baseCost > 0 && Number.isFinite(price) && price > 0) {
      setMarkup((price / baseCost).toFixed(2));
    }
  }

  function onMarkupChange(value: string) {
    setMarkup(value);
    const m = Number(value);
    if (baseCost > 0 && Number.isFinite(m) && m > 0) {
      setRetail((baseCost * m).toFixed(2));
    }
  }
  const [copyReason, setCopyReason] = useState("");
  const [suggestion, setSuggestion] = useState<{ title: string; descriptionHtml: string } | null>(null);
  const [publishMsg, setPublishMsg] = useState<{ tone: "profit" | "warn" | "loss"; text: string; href?: string } | null>(
    null,
  );
  const [priceMsg, setPriceMsg] = useState("");
  const [copyMsg, setCopyMsg] = useState("");
  const [showSupplier, setShowSupplier] = useState(false);

  function runPublish() {
    startPublish(async () => {
      setPublishMsg({ tone: "warn", text: "Publishing to your store…" });
      try {
        const res = await publishProduct(product.id);
        setPublishMsg({
          tone: "profit",
          text: "Live on your Seto store.",
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
          <a href="/store" className="mt-2 inline-block text-xs text-accent">
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
            <p className="text-xs uppercase tracking-wider text-faint">Storefront copy</p>
            <div
              className="prose-sm text-sm text-muted [&_li]:ml-4 [&_li]:list-disc [&_p]:mb-2"
              dangerouslySetInnerHTML={{ __html: product.descriptionHtml ?? "" }}
            />
            <Button
              tone="line"
              disabled={rewriting}
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
              {rewriting ? "Rewriting…" : "Rewrite title & bullets"}
            </Button>
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
                <dt className="text-faint">Your cost</dt>
                <dd>{money(product.economics.cogs)}</dd>
              </div>
              <div>
                <dt className="text-faint">Card fee</dt>
                <dd>{money(product.economics.fee)}</dd>
              </div>
              <div>
                <dt className="text-faint">Profit / unit</dt>
                <dd className="text-profit">{money(product.economics.profit)}</dd>
              </div>
              <div>
                <dt className="text-faint">Margin</dt>
                <dd>
                  {pct(product.economics.margin)}
                  {product.shippingCost <= 0 ? (
                    <span className="ml-1 text-[10px] text-warn">est., shipping unknown</span>
                  ) : null}
                </dd>
              </div>
            </dl>
            <div className="mt-4 grid grid-cols-1 gap-2">
              <Field label="Selling price">
                <input className={inputClass} value={retail} onChange={(e) => onRetailChange(e.target.value)} />
              </Field>
              <Field label="Markup">
                <input className={inputClass} value={markup} onChange={(e) => onMarkupChange(e.target.value)} />
              </Field>
              <Field label="Ship $">
                <input className={inputClass} value={shipping} onChange={(e) => setShipping(e.target.value)} />
              </Field>
            </div>
            {product.shippingCost <= 0 ? (
              <p className="mt-2 text-xs text-warn">
                Supplier freight was not available — margin is estimated until you enter ship cost.
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
            <p className="mt-2 text-xs text-muted">{product.shippingDays} day typical transit</p>
            <div className="mt-4 flex gap-2">
              <Button
                tone="line"
                disabled={statusPending}
                onClick={() => startStatus(() => setProductStatus(product.id, "ready"))}
              >
                Mark ready
              </Button>
              <Button
                tone="ghost"
                disabled={statusPending}
                onClick={() => startStatus(() => setProductStatus(product.id, "archived"))}
              >
                Archive
              </Button>
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
