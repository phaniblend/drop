"use server";

import { revalidatePath } from "next/cache";
import { enrichCopy } from "@/lib/ai-copy";
import { ensureDb } from "@/lib/db";
import { findProductBySupplierUrl, getProduct, insertImportedProduct, writeProductPricing } from "@/lib/db/queries";
import { products } from "@/lib/db/schema";
import { logActivity } from "@/lib/db/seed";
import { suggestedRetail } from "@/lib/money";
import { publishProductToStore } from "@/lib/storefront";
import { listingToParsed, scrapeSupplierUrl } from "@/lib/scraper";
import type { FeedProduct } from "@/lib/supplier-feed";
import { eq } from "drizzle-orm";
import { num, parseCsv } from "@/lib/csv";
import { assertProductQuota, isBillingError } from "@/lib/billing";
import type { PaywallPayload } from "@/lib/paywall";
import type { ScrapedListing } from "@/lib/aliexpress-scrape/types";

function paywallResult(error: unknown): { paywall: PaywallPayload } {
  if (isBillingError(error)) return { paywall: error.paywall };
  throw error;
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

export async function importFromFeed(_feedId: string) {
  throw new Error("Sample supplier feed is retired. Search live listings or paste a supplier URL.");
}

/** Import a live Discover card — refresh via supplier scrape/API for real stock & freight. */
export async function importLiveListing(feed: FeedProduct) {
  if (!feed?.url || !feed.live) {
    throw new Error("Only live supplier listings can be imported.");
  }
  // Prefer full product fetch so stock/ship are not the Discover feed placeholders.
  try {
    return await importFromSupplierUrl(feed.url);
  } catch (first) {
    // Fall back to the search snapshot if the listing scrape is blocked.
    const existing = await findProductBySupplierUrl(feed.url);
    if (!existing) {
      try {
        await assertProductQuota();
      } catch (error) {
        return paywallResult(error);
      }
    }
    const copy = await enrichCopy({
      rawTitle: feed.cleanTitle || feed.title,
      cost: feed.cost,
      shipping: feed.shipping,
      niche: feed.niche,
    });
    const retail = suggestedRetail(feed.cost, feed.shipping, 3);
    const id = await insertImportedProduct({
      rawTitle: feed.title,
      cleanTitle: copy.title,
      descriptionHtml: copy.descriptionHtml,
      supplierUrl: feed.url,
      supplierName: feed.supplierName,
      supplierSource: feed.source,
      imageUrl: feed.image,
      gallery: feed.image ? [feed.image] : [],
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
      message: `Imported ${copy.title} from feed snapshot (${
        first instanceof Error ? first.message.slice(0, 80) : "scrape failed"
      }).`,
      href: `/catalog/${id}`,
    });
    revalidatePath("/catalog");
    revalidatePath("/discover");
    revalidatePath("/");
    revalidatePath("/", "layout");
    return { id, reused: Boolean(existing) };
  }
}

export async function searchDiscover(
  query: string,
  niche = "all",
): Promise<{ mode: "live"; items: FeedProduct[]; error?: string }> {
  const { searchLiveSuppliers } = await import("@/lib/discover-search");
  return searchLiveSuppliers(query, niche);
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
    descriptionHint: product.descriptionHtml ?? undefined,
  });

  // AI mode applies immediately. Local fallback is a suggestion only (Apply/Discard in UI).
  if (copy.mode === "ai" && copy.applyTitle) {
    const db = await ensureDb();
    await db
      .update(products)
      .set({ cleanTitle: copy.title, descriptionHtml: copy.descriptionHtml })
      .where(eq(products.id, productId));
    revalidatePath(`/catalog/${productId}`);
  }

  return copy;
}

export async function applyCopySuggestion(
  productId: string,
  input: { title: string; descriptionHtml: string },
) {
  const db = await ensureDb();
  await db
    .update(products)
    .set({
      cleanTitle: input.title.trim() || undefined,
      descriptionHtml: input.descriptionHtml,
    })
    .where(eq(products.id, productId));
  revalidatePath(`/catalog/${productId}`);
  return { ok: true as const };
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
  const result = publishProductToStore({
    id: product.id,
    title: product.cleanTitle || product.rawTitle,
  });
  const db = await ensureDb();
  await db
    .update(products)
    .set({ status: "published", shopifyProductId: result.productId })
    .where(eq(products.id, productId));
  await logActivity(db, {
    kind: "publish",
    message: `${product.cleanTitle} is live on your Seto store.`,
    href: `/store/${product.id}`,
  });
  revalidatePath(`/catalog/${productId}`);
  revalidatePath("/catalog");
  revalidatePath("/store");
  revalidatePath(`/store/${product.id}`);
  revalidatePath("/");
  return {
    ...result,
    updated: Boolean(product.status === "published"),
    status: "published" as const,
    storefrontUrl: result.storeUrl,
  };
}

export async function setProductStatus(productId: string, status: string) {
  const db = await ensureDb();
  await db.update(products).set({ status }).where(eq(products.id, productId));
  revalidatePath("/catalog");
  revalidatePath(`/catalog/${productId}`);
}
