"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  publishProduct,
  rewriteProductCopy,
  setProductStatus,
} from "@/app/actions/products";
import { postJson } from "@/lib/retry-fetch";
import { money, pct } from "@/lib/utils";
import { humanizeVariantLabel } from "@/lib/variant-label";
import { Badge, Button, Card, CardHeader, Field, inputClass } from "./ui";
import { StatusPill } from "./status-pill";
import { Thumb } from "./thumb";
import type { CampaignTracker, Product, ProductVariant } from "@/lib/db/schema";
import { AdHooksPanel } from "./ad-hooks-panel";

type Economics = { cogs: number; fee: number; profit: number; margin: number };

export function ProductEditor({
  product,
}: {
  product: Product & {
    variants: ProductVariant[];
    campaigns: CampaignTracker[];
    economics: Economics;
  };
}) {
  const router = useRouter();
  const [savingPrice, startPrice] = useTransition();
  const [rewriting, startRewrite] = useTransition();
  const [publishing, startPublish] = useTransition();
  const [statusPending, startStatus] = useTransition();
  const [retail, setRetail] = useState(String(product.retailPrice));
  const [markup, setMarkup] = useState(String(product.markupMultiplier));
  const [shipping, setShipping] = useState(String(product.shippingCost));
  const [copyMode, setCopyMode] = useState("");
  const [publishMsg, setPublishMsg] = useState("");
  const [priceMsg, setPriceMsg] = useState("");
  const [copyMsg, setCopyMsg] = useState("");
  const [showSupplier, setShowSupplier] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">Product</p>
          <h1 className="mt-1 text-2xl font-semibold">{product.cleanTitle ?? product.rawTitle}</h1>
          <p className="mt-1 max-w-xl text-sm text-muted">{product.rawTitle}</p>
        </div>
        <div className="flex gap-2">
          <StatusPill value={product.status} />
          <Button
            tone="accent"
            disabled={publishing}
            onClick={() =>
              startPublish(async () => {
                const res = await publishProduct(product.id);
                setPublishMsg(res.warning ?? `Shopify id ${res.productId}`);
                router.refresh();
              })
            }
          >
            Publish to Shopify
          </Button>
        </div>
      </div>

      {publishMsg ? <p className="text-sm text-warn">{publishMsg}</p> : null}

      <AdHooksPanel
        title={product.cleanTitle ?? product.rawTitle}
        description={product.descriptionHtml ?? ""}
        price={product.retailPrice}
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
                  try {
                    const copy = await rewriteProductCopy(product.id);
                    setCopyMode(copy.mode);
                    setCopyMsg("Title and bullets updated.");
                    router.refresh();
                  } catch {
                    setCopyMsg("Could not rewrite. Try again.");
                  }
                })
              }
            >
              {rewriting ? "Rewriting…" : "Rewrite title & bullets"}
            </Button>
            {copyMode ? (
              <Badge tone={copyMode === "ai" ? "profit" : "line"}>
                {copyMode === "ai" ? "AI rewrite" : "Quick clean"}
              </Badge>
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
                <dd>{pct(product.economics.margin)}</dd>
              </div>
            </dl>
            <div className="mt-4 grid grid-cols-1 gap-2">
              <Field label="Selling price">
                <input className={inputClass} value={retail} onChange={(e) => setRetail(e.target.value)} />
              </Field>
              <Field label="Markup">
                <input className={inputClass} value={markup} onChange={(e) => setMarkup(e.target.value)} />
              </Field>
              <Field label="Ship $">
                <input className={inputClass} value={shipping} onChange={(e) => setShipping(e.target.value)} />
              </Field>
            </div>
            <Button
              className="mt-3"
              tone="line"
              disabled={savingPrice}
              onClick={() =>
                startPrice(async () => {
                  setPriceMsg("");
                  try {
                    await postJson<{ ok: boolean }>("/api/catalog/pricing", {
                      productId: product.id,
                      retailPrice: Number(retail),
                      markupMultiplier: Number(markup),
                      shippingCost: Number(shipping),
                    });
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
            {product.variants.map((v) => (
              <tr key={v.id}>
                <td className="px-4 py-3">{humanizeVariantLabel(v.variantName)}</td>
                {showSupplier ? <td className="px-4 py-3 font-mono text-xs">{v.supplierSkuId}</td> : null}
                <td className="px-4 py-3 font-mono text-xs">{money(v.variantCost)}</td>
                <td className="px-4 py-3 font-mono text-xs">{money(v.variantPrice)}</td>
                <td className="px-4 py-3 font-mono text-xs">{v.inventoryCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
