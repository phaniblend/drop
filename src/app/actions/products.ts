"use server";

import { revalidatePath } from "next/cache";
import { enrichCopy } from "@/lib/ai-copy";
import { ensureDb } from "@/lib/db";
import { findProductBySupplierUrl, getProduct, insertImportedProduct, writeProductPricing } from "@/lib/db/queries";
import { products } from "@/lib/db/schema";
import { logActivity } from "@/lib/db/seed";
import { suggestedRetail } from "@/lib/money";
import { publishProductToShopify } from "@/lib/publisher";
import { listingToParsed, scrapeSupplierUrl } from "@/lib/scraper";
import { getFeedProduct, searchFeed, type FeedProduct } from "@/lib/supplier-feed";
import { eq } from "drizzle-orm";
import { num, parseCsv } from "@/lib/csv";
import { assertProductQuota, isBillingError } from "@/lib/billing";
import type { PaywallPayload } from "@/lib/paywall";
import type { ScrapedListing } from "@/lib/aliexpress-scrape/types";

function paywallResult(error: unknown): { paywall: PaywallPayload } {
  if (isBillingError(error)) return { paywall: error.paywall };
  throw error;
}

export async function importFromFeed(feedId: string) {
  const feed = getFeedProduct(feedId);
  if (!feed) throw new Error("That supplier listing is no longer in the feed.");
  const existing = await findProductBySupplierUrl(feed.url);
  if (!existing) {
    try {
      await assertProductQuota();
    } catch (error) {
      return paywallResult(error);
    }
  }
  const copy = await enrichCopy({
    rawTitle: feed.cleanTitle,
    cost: feed.cost,
    shipping: feed.shipping,
    niche: feed.niche,
  });
  const retail = suggestedRetail(feed.cost, feed.shipping, 3);
  const id = await insertImportedProduct({
    rawTitle: feed.title,
    cleanTitle: feed.cleanTitle,
    descriptionHtml: copy.descriptionHtml,
    supplierUrl: feed.url,
    supplierName: feed.supplierName,
    supplierSource: feed.source,
    imageUrl: feed.image,
    gallery: [feed.image],
    baseCost: feed.cost,
    shippingCost: feed.shipping,
    retailPrice: retail,
    shippingDays: feed.shippingDays,
    niche: feed.niche,
    tags: feed.tags.join(","),
    variants: feed.variants.map((v) => ({
      skuId: v.skuId,
      name: v.attributes,
      cost: v.cost,
      price: suggestedRetail(v.cost, feed.shipping, 3),
      stock: v.stock,
      imageUrl: feed.image,
    })),
  });
  const db = await ensureDb();
  await logActivity(db, {
    kind: "import",
    message: existing
      ? `Updated existing draft for ${copy.title}.`
      : `Imported ${copy.title} from ${feed.supplierName}.`,
    href: `/catalog/${id}`,
  });
  revalidatePath("/catalog");
  revalidatePath("/discover");
  revalidatePath("/");
  revalidatePath("/", "layout");
  return { id, reused: Boolean(existing) };
}

export async function importFromSupplierUrl(url: string) {
  const existing = await findProductBySupplierUrl(url);
  if (!existing) {
    try {
      await assertProductQuota();
    } catch (error) {
      return paywallResult(error);
    }
  }
  const parsed = await scrapeSupplierUrl(url);
  const copy = await enrichCopy({
    rawTitle: parsed.title,
    cost: parsed.baseCost,
    shipping: parsed.shippingCost,
  });
  const retail = suggestedRetail(parsed.baseCost, parsed.shippingCost, 3);
  const id = await insertImportedProduct({
    rawTitle: parsed.title,
    cleanTitle: copy.title,
    descriptionHtml: copy.descriptionHtml,
    supplierUrl: url,
    supplierSource: parsed.source,
    imageUrl: parsed.galleryImages[0],
    gallery: parsed.galleryImages,
    baseCost: parsed.baseCost,
    shippingCost: parsed.shippingCost,
    retailPrice: retail,
    shippingDays: parsed.shippingDays,
    variants:
      parsed.variants.length > 0
        ? parsed.variants.map((v) => ({
            skuId: v.skuId,
            name: v.attributes,
            cost: v.cost,
            price: suggestedRetail(v.cost, parsed.shippingCost, 3),
            stock: v.stock,
            imageUrl: v.imageUrl,
          }))
        : [
            {
              skuId: "DEFAULT",
              name: "Default",
              cost: parsed.baseCost,
              price: retail,
              stock: 0,
            },
          ],
  });
  const db = await ensureDb();
  await logActivity(db, {
    kind: "import",
    message: existing
      ? `Updated existing draft for ${copy.title} (${parsed.importPath === "page" ? "listing page" : "official catalog"}).`
      : `Imported ${copy.title} (${parsed.importPath === "page" ? "listing page" : "official catalog"}).`,
    href: `/catalog/${id}`,
  });
  revalidatePath("/catalog");
  revalidatePath("/");
  revalidatePath("/", "layout");
  return { id, reused: Boolean(existing) };
}

export async function importScrapedListing(listing: ScrapedListing) {
  const existing = await findProductBySupplierUrl(listing.supplierUrl);
  if (!existing) {
    try {
      await assertProductQuota();
    } catch (error) {
      return paywallResult(error);
    }
  }
  const parsed = listingToParsed(listing);
  const copy = await enrichCopy({
    rawTitle: parsed.title,
    cost: parsed.baseCost,
    shipping: parsed.shippingCost,
  });
  const retail = suggestedRetail(parsed.baseCost, parsed.shippingCost, 3);
  const id = await insertImportedProduct({
    rawTitle: parsed.title,
    cleanTitle: copy.title,
    descriptionHtml: copy.descriptionHtml,
    supplierUrl: listing.supplierUrl,
    supplierSource: parsed.source,
    imageUrl: parsed.galleryImages[0],
    gallery: parsed.galleryImages,
    baseCost: parsed.baseCost,
    shippingCost: parsed.shippingCost,
    retailPrice: retail,
    shippingDays: parsed.shippingDays,
    variants:
      parsed.variants.length > 0
        ? parsed.variants.map((v) => ({
            skuId: v.skuId,
            name: v.attributes,
            cost: v.cost,
            price: suggestedRetail(v.cost, parsed.shippingCost, 3),
            stock: v.stock,
            imageUrl: v.imageUrl,
          }))
        : [
            {
              skuId: "DEFAULT",
              name: "Default",
              cost: parsed.baseCost,
              price: retail,
              stock: 0,
            },
          ],
  });
  const db = await ensureDb();
  await logActivity(db, {
    kind: "import",
    message: existing
      ? `Updated existing draft for ${copy.title} (listing page).`
      : `Imported ${copy.title} (listing page).`,
    href: `/catalog/${id}`,
  });
  revalidatePath("/catalog");
  revalidatePath("/");
  revalidatePath("/", "layout");
  return { id, reused: Boolean(existing) };
}

export async function searchDiscover(
  query: string,
  niche = "all",
): Promise<{ mode: "live" | "demo"; items: FeedProduct[]; error?: string }> {
  const { integrationStatus } = await import("@/lib/env");
  const canSearch = query.trim().length >= 2 || niche !== "all";
  if (integrationStatus().aliexpress && canSearch) {
    try {
      const { searchAliExpress } = await import("@/lib/integrations/aliexpress");
      const items = await searchAliExpress(query.trim(), niche);
      return {
        mode: "live",
        items,
        error:
          items.length === 0
            ? niche !== "all" && query.trim()
              ? `No ${niche} listings matched that name. Try All, or a more specific product.`
              : "No live listings matched that name. Try two or three simple words."
            : undefined,
      };
    } catch (error) {
      return {
        mode: "live",
        items: [],
        error: error instanceof Error ? error.message : "AliExpress search failed.",
      };
    }
  }
  return { mode: "demo", items: searchFeed(query, niche) };
}

export async function importProductsCsv(text: string) {
  const rows = parseCsv(text);
  if (!rows.length) throw new Error("CSV needs a header row plus at least one product.");
  const ids: string[] = [];
  for (const row of rows) {
    const rawTitle = row.title || row.raw_title || row.name;
    if (!rawTitle) continue;
    try {
      await assertProductQuota();
    } catch (error) {
      const paywall = paywallResult(error);
      return { ...paywall, count: ids.length };
    }
    const cost = num(row.base_cost || row.cost);
    const shipping = num(row.shipping_cost || row.shipping);
    const copy = await enrichCopy({ rawTitle, cost, shipping });
    const retail = num(row.retail_price || row.price, suggestedRetail(cost, shipping, 3));
    const imageUrl = row.image_url || row.image || row.thumbnail || "";
    const id = await insertImportedProduct({
      rawTitle,
      cleanTitle: copy.title,
      descriptionHtml: copy.descriptionHtml,
      supplierUrl: row.supplier_url || row.url || "https://www.aliexpress.com",
      supplierName: row.supplier || "CSV import",
      supplierSource: (row.source as "aliexpress" | "cj") || "manual",
      imageUrl: imageUrl || undefined,
      gallery: imageUrl ? [imageUrl] : [],
      baseCost: cost,
      shippingCost: shipping,
      retailPrice: retail,
      shippingDays: Math.round(num(row.shipping_days, 14)),
      niche: row.niche || "general",
      tags: row.tags || "imported",
      variants: [
        {
          skuId: row.product_code || row.sku || `P-${ids.length + 1}`,
          name: row.variant || "Default",
          cost,
          price: retail,
          stock: Math.round(num(row.inventory || row.stock, 0)),
          imageUrl: imageUrl || undefined,
        },
      ],
    });
    ids.push(id);
  }
  if (!ids.length) {
    throw new Error("No rows had a title. Need columns like title, cost, shipping, product_code, stock.");
  }
  const db = await ensureDb();
  await logActivity(db, {
    kind: "import",
    message: `CSV imported ${ids.length} products into drafts.`,
    href: "/catalog",
  });
  revalidatePath("/catalog");
  revalidatePath("/");
  revalidatePath("/", "layout");
  return { count: ids.length };
}

export async function rewriteProductCopy(productId: string) {
  const product = await getProduct(productId);
  if (!product) throw new Error("Product not found.");
  const copy = await enrichCopy({
    rawTitle: product.rawTitle,
    cost: product.baseCost,
    shipping: product.shippingCost,
    niche: product.niche,
    currentTitle: product.cleanTitle ?? undefined,
  });
  const db = await ensureDb();
  await db
    .update(products)
    .set({ cleanTitle: copy.title, descriptionHtml: copy.descriptionHtml })
    .where(eq(products.id, productId));
  revalidatePath(`/catalog/${productId}`);
  return copy;
}

export async function updateProductPricing(
  productId: string,
  input: { retailPrice: number; markupMultiplier: number; shippingCost: number },
) {
  await writeProductPricing(productId, input);
}

export async function publishProduct(productId: string) {
  const product = await getProduct(productId);
  if (!product) throw new Error("Product not found.");
  const result = await publishProductToShopify({
    title: product.cleanTitle || product.rawTitle,
    descriptionHtml: product.descriptionHtml || `<p>${product.cleanTitle}</p>`,
    tags: product.tags.split(",").map((t) => t.trim()).filter(Boolean),
    variants: product.variants.map((v) => ({
      sku: v.supplierSkuId,
      cost: v.variantCost,
      title: v.variantName,
      price: v.variantPrice,
    })),
  });
  const db = await ensureDb();
  await db
    .update(products)
    .set({ status: "published", shopifyProductId: result.productId })
    .where(eq(products.id, productId));
  await logActivity(db, {
    kind: "publish",
    message: result.warning
      ? `${product.cleanTitle} marked published locally (Shopify offline).`
      : `${product.cleanTitle} pushed to Shopify as ${result.handle}.`,
    href: `/catalog/${productId}`,
  });
  revalidatePath(`/catalog/${productId}`);
  revalidatePath("/catalog");
  revalidatePath("/");
  const { shopifyProductUrl, shopifyStorefrontHomeUrl } = await import("@/lib/shopify-storefront");
  return {
    ...result,
    storefrontUrl: shopifyProductUrl(result.handle) || shopifyStorefrontHomeUrl(),
  };
}

export async function setProductStatus(productId: string, status: string) {
  const db = await ensureDb();
  await db.update(products).set({ status }).where(eq(products.id, productId));
  revalidatePath("/catalog");
  revalidatePath(`/catalog/${productId}`);
}
