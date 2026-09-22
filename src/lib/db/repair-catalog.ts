import "server-only";

import { eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { normalizeSupplierStock, normalizeVariantStocks } from "../supplier-stock";
import { humanizeVariantLabel, labeledVariantName } from "../variant-label";
import { nowIso } from "../utils";
import * as schema from "./schema";

type DB = LibSQLDatabase<typeof schema>;

/**
 * One-shot / on-demand repair for catalog rows imported before label/stock/price fixes.
 * Caps fake inventory, humanizes "Option" variant names, aligns sell prices to markup.
 */
export async function repairCatalogData(db: DB): Promise<{
  variantsFixed: number;
  productsPriced: number;
  suppliersLinked: number;
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
      const nextPrice = Number((row.variantCost * product.markupMultiplier).toFixed(2));
      const changed =
        stock !== row.inventoryCount || nextName !== row.variantName || nextPrice !== row.variantPrice;
      if (!changed) continue;
      await db
        .update(schema.productVariants)
        .set({
          inventoryCount: stock,
          variantName: nextName,
          variantPrice: nextPrice,
        })
        .where(eq(schema.productVariants.id, row.id));
      variantsFixed += 1;
    }

    const first = capped[0];
    const alignedRetail = first
      ? Number((rows[0]!.variantCost * product.markupMultiplier).toFixed(2))
      : product.retailPrice;
    if (Math.abs(alignedRetail - product.retailPrice) > 0.009) {
      await db
        .update(schema.products)
        .set({ retailPrice: alignedRetail })
        .where(eq(schema.products.id, productId));
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
      notes: "Linked from catalog repair",
    });
    suppliersLinked += 1;
  }

  try {
    await db.insert(schema.settings).values({
      key: "catalog_repair_v3",
      value: nowIso(),
    });
  } catch {
    await db
      .update(schema.settings)
      .set({ value: nowIso() })
      .where(eq(schema.settings.key, "catalog_repair_v3"));
  }

  return { variantsFixed, productsPriced, suppliersLinked };
}
