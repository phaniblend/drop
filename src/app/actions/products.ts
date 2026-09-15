"use server";

import { revalidatePath } from "next/cache";
import { enrichCopy } from "@/lib/ai-copy";
import { ensureDb } from "@/lib/db";
import { getProduct, insertImportedProduct } from "@/lib/db/queries";
import { products, productVariants } from "@/lib/db/schema";
import { logActivity } from "@/lib/db/seed";
import { suggestedRetail } from "@/lib/money";
import { publishProductToShopify } from "@/lib/publisher";
import { scrapeSupplierUrl } from "@/lib/scraper";
import { getFeedProduct } from "@/lib/supplier-feed";
import { eq } from "drizzle-orm";
import { num, parseCsv } from "@/lib/csv";

export async function importFromFeed(feedId: string) {
  const feed = getFeedProduct(feedId);
  if (!feed) throw new Error("That supplier listing is no longer in the feed.");
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
    message: `Imported ${copy.title} from ${feed.supplierName}.`,
    href: `/catalog/${id}`,
  });
  revalidatePath("/catalog");
  revalidatePath("/discover");
  revalidatePath("/");
  return { id };
}

export async function importFromSupplierUrl(url: string) {
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
    message: `Imported ${copy.title} from supplier URL.`,
    href: `/catalog/${id}`,
  });
  revalidatePath("/catalog");
  revalidatePath("/");
  return { id };
}

export async function importProductsCsv(text: string) {
  const rows = parseCsv(text);
  if (!rows.length) throw new Error("CSV needs a header row plus at least one product.");
  const ids: string[] = [];
  for (const row of rows) {
    const rawTitle = row.title || row.raw_title || row.name;
    if (!rawTitle) continue;
    const cost = num(row.base_cost || row.cost);
    const shipping = num(row.shipping_cost || row.shipping);
    const copy = await enrichCopy({ rawTitle, cost, shipping });
    const retail = num(row.retail_price || row.price, suggestedRetail(cost, shipping, 3));
    const id = await insertImportedProduct({
      rawTitle,
      cleanTitle: copy.title,
      descriptionHtml: copy.descriptionHtml,
      supplierUrl: row.supplier_url || row.url || "https://www.aliexpress.com",
      supplierName: row.supplier || "CSV import",
      supplierSource: (row.source as "aliexpress" | "cj") || "manual",
      baseCost: cost,
      shippingCost: shipping,
      retailPrice: retail,
      shippingDays: Math.round(num(row.shipping_days, 14)),
      niche: row.niche || "general",
      tags: row.tags || "imported",
      variants: [
        {
          skuId: row.sku || `SKU-${ids.length + 1}`,
          name: row.variant || "Default",
          cost,
          price: retail,
          stock: Math.round(num(row.inventory || row.stock, 0)),
        },
      ],
    });
    ids.push(id);
  }
  const db = await ensureDb();
  await logActivity(db, {
    kind: "import",
    message: `CSV imported ${ids.length} products into drafts.`,
    href: "/catalog",
  });
  revalidatePath("/catalog");
  revalidatePath("/");
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
  const db = await ensureDb();
  await db
    .update(products)
    .set({
      retailPrice: input.retailPrice,
      markupMultiplier: input.markupMultiplier,
      shippingCost: input.shippingCost,
    })
    .where(eq(products.id, productId));
  const vars = await db.select().from(productVariants).where(eq(productVariants.productId, productId));
  for (const v of vars) {
    await db
      .update(productVariants)
      .set({ variantPrice: Number((v.variantCost * input.markupMultiplier).toFixed(2)) })
      .where(eq(productVariants.id, v.id));
  }
  revalidatePath(`/catalog/${productId}`);
  revalidatePath("/catalog");
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
  return result;
}

export async function setProductStatus(productId: string, status: string) {
  const db = await ensureDb();
  await db.update(products).set({ status }).where(eq(products.id, productId));
  revalidatePath("/catalog");
  revalidatePath(`/catalog/${productId}`);
}
