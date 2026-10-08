import "server-only";

import { eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { discoverCardTitle } from "../copy-local";
import { normalizeSupplierStock, normalizeVariantStocks } from "../supplier-stock";
import { humanizeVariantLabel, labeledVariantName } from "../variant-label";
import { nowIso } from "../utils";
import * as schema from "./schema";

type DB = LibSQLDatabase<typeof schema>;

const REPAIR_KEY = "catalog_repair_v6";

const OLD_TEMPLATE =
  /is designed for daily use|Easy to install|simple setup, a clean look, and tracked shipping/i;

/**
 * Caps fake inventory, humanizes "Option" variant names, cleans titles,
 * replaces old category-template copy, and fixes obviously broken variant ladders.
 * Does not silently overwrite hand-tuned prices that already match markup.
 */
export async function repairCatalogData(db: DB): Promise<{
  variantsFixed: number;
  productsPriced: number;
  suppliersLinked: number;
  titlesFixed: number;
  copyFixed: number;
}> {
  const variants = await db.select().from(schema.productVariants);
  const products = await db.select().from(schema.products);

  const byProduct = new Map<string, typeof variants>();
  for (const v of variants) {
    const list = byProduct.get(v.productId) ?? [];
    list.push(v);
    byProduct.set(v.productId, list);
  }

  let variantsFixed = 0;
  let productsPriced = 0;
  let titlesFixed = 0;
  let copyFixed = 0;

  for (const [productId, rows] of byProduct) {
    const product = products.find((p) => p.id === productId);
    if (!product) continue;

    const capped = normalizeVariantStocks(rows.map((v) => ({ ...v, stock: v.inventoryCount })));
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const stock = capped[i]?.stock ?? normalizeSupplierStock(row.inventoryCount);
      const label = humanizeVariantLabel(row.variantName);
      const nextName =
        label === "Option" || /^Variant \d+$/i.test(row.variantName)
          ? labeledVariantName(row.variantName, i, undefined, {
              sku: row.supplierSkuId,
              cost: row.variantCost,
            })
          : row.variantName;
      const changed = stock !== row.inventoryCount || nextName !== row.variantName;
      if (!changed) continue;
      await db
        .update(schema.productVariants)
        .set({
          inventoryCount: stock,
          variantName: nextName,
        })
        .where(eq(schema.productVariants.id, row.id));
      variantsFixed += 1;
    }
  }

  for (const p of products) {
    const source = (p.cleanTitle || p.rawTitle || "").trim();
    if (!source) continue;
    const next = discoverCardTitle(p.rawTitle || source);
    const current = p.cleanTitle?.trim() || "";
    const looksJunk =
      Boolean(next) &&
      next !== current &&
      (!current ||
        /\b(20\d{2}|hot selling|top rated|local stock|wholesale|dropship|usb hanging|mah usb)\b/i.test(
          current,
        ) ||
        /\b(for|with|and|or|the|a|an|of|to|in|on)\s*$/i.test(current) ||
        /^(for|in|with|pack)\b/i.test(current) ||
        /^\d+[a-z]/i.test(current) ||
        (/usb|led|mah/i.test(current) && current === current.toLowerCase()) ||
        current !== discoverCardTitle(current));
    const patch: { cleanTitle?: string; descriptionHtml?: string } = {};
    if (looksJunk && next) {
      patch.cleanTitle = next;
      titlesFixed += 1;
    }
    const html = p.descriptionHtml ?? "";
    if (OLD_TEMPLATE.test(html)) {
      const { shopperFallbackHtml } = await import("../shopper-copy");
      patch.descriptionHtml = shopperFallbackHtml(patch.cleanTitle || current || next || "This product");
      copyFixed += 1;
    }
    if (Object.keys(patch).length) {
      await db.update(schema.products).set(patch).where(eq(schema.products.id, p.id));
    }
  }

  // Reprice ladders that look like the old "wrong-anchor" bug (huge price spread vs cost spread).
  const { scaleVariantPrices, pricingAnchorCost } = await import("../variant-pricing");
  const { pricesMatchMarkup } = await import("../money");
  for (const p of products) {
    const rows = byProduct.get(p.id) ?? [];
    if (rows.length < 2) continue;
    const costs = rows.map((v) => v.variantCost).filter((c) => c > 0);
    const prices = rows.map((v) => v.variantPrice).filter((c) => c > 0);
    if (costs.length < 2 || prices.length < 2) continue;
    const costSpread = Math.max(...costs) / Math.min(...costs);
    const priceSpread = Math.max(...prices) / Math.min(...prices);
    if (!(priceSpread > 5 && costSpread < 4)) continue;
    const ship = p.shippingCost > 0 ? p.shippingCost : 0;
    const markup = p.markupMultiplier > 0 ? p.markupMultiplier : 3;
    const anchor = pricingAnchorCost(rows.map((v) => ({ cost: v.variantCost })));
    if (pricesMatchMarkup(p.retailPrice, anchor || p.baseCost, ship, markup)) {
      // Already consistent with markup — still rescale variants to retail endings.
    } else if (priceSpread > 8) {
      // Clearly broken ladder — rescale from current retail + markup.
    } else {
      continue;
    }
    const scaled = scaleVariantPrices(
      rows.map((v) => ({ cost: v.variantCost })),
      p.retailPrice,
      ship,
      markup,
    );
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const nextPrice = scaled[i] ?? row.variantPrice;
      if (Math.abs(nextPrice - row.variantPrice) < 0.02) continue;
      await db
        .update(schema.productVariants)
        .set({ variantPrice: nextPrice })
        .where(eq(schema.productVariants.id, row.id));
      productsPriced += 1;
    }
  }

  let suppliersLinked = 0;
  const names = new Set<string>();
  for (const p of products) {
    const name = p.supplierName?.trim() || "AliExpress";
    if (names.has(name.toLowerCase())) continue;
    names.add(name.toLowerCase());
    const [existing] = await db
      .select()
      .from(schema.suppliers)
      .where(eq(schema.suppliers.name, name))
      .limit(1);
    if (existing) continue;
    await db.insert(schema.suppliers).values({
      id: `sup_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`,
      name,
      platform: p.supplierSource || "aliexpress",
      storeUrl: p.supplierUrl,
      avgShippingDays: p.shippingDays || 14,
      reliability: 0.9,
      notes: "Added from your catalog",
    });
    suppliersLinked += 1;
  }

  try {
    await db.insert(schema.settings).values({
      key: REPAIR_KEY,
      value: nowIso(),
    });
  } catch {
    await db
      .update(schema.settings)
      .set({ value: nowIso() })
      .where(eq(schema.settings.key, REPAIR_KEY));
  }

  return { variantsFixed, productsPriced, suppliersLinked, titlesFixed, copyFixed };
}
