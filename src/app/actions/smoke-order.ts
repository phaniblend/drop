"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { ensureDb } from "@/lib/db";
import { getOperator, listProducts } from "@/lib/db/queries";
import { orderItems, orders, productVariants } from "@/lib/db/schema";
import { logActivity } from "@/lib/db/seed";
import { netProfit, processorFee } from "@/lib/money";
import { nid, nowIso } from "@/lib/utils";

/**
 * Creates one pending practice order so Fulfill → tracking can be walked
 * without a real card. Clearly labeled PRACTICE — not a Stripe payment.
 */
export async function createPracticeOrder() {
  const operator = await getOperator();
  if (!operator) throw new Error("Sign in first.");

  const catalog = await listProducts();
  const product =
    catalog.find((p) => p.status === "published" && p.stock > 0) ||
    catalog.find((p) => p.status === "published") ||
    catalog[0];
  if (!product) {
    return { error: "Import and publish one product first, then run practice order." };
  }

  const variant = product.variants.find((v) => v.inventoryCount > 0) || product.variants[0];
  const unitPrice = variant?.variantPrice || product.retailPrice || 19.99;
  const unitCost = variant?.variantCost || product.baseCost || 5;
  const qty = 1;
  const revenue = unitPrice * qty;
  const cogs = (unitCost + product.shippingCost) * qty;
  const fee = processorFee(revenue);
  const id = nid("ord");
  const orderNumber = `PRACTICE-${Date.now().toString(36).toUpperCase().slice(-6)}`;

  const db = await ensureDb();
  await db.insert(orders).values({
    id,
    userId: operator.id,
    shopifyOrderId: `practice_${id}`,
    orderNumber,
    customerName: "Practice Buyer",
    customerEmail: "practice@seto.store",
    shippingAddress: "123 Practice St, Austin, TX 78701, US",
    totalRevenue: revenue,
    totalCogs: cogs,
    paymentFee: fee,
    netMargin: netProfit({ revenue, cogs }),
    fulfillmentStatus: "pending_batch",
    createdAt: nowIso(),
  });

  const { shopperVariantLabel } = await import("@/lib/shopper-copy");
  const option = variant?.variantName ? shopperVariantLabel(variant.variantName) : "";
  const titleBase = product.cleanTitle || product.rawTitle;
  await db.insert(orderItems).values({
    id: nid("itm"),
    orderId: id,
    productId: product.id,
    variantId: variant?.id ?? "default",
    title: option ? `${titleBase} · ${option}` : titleBase,
    sku: variant?.supplierSkuId || "PRACTICE",
    quantity: qty,
    unitPrice,
    unitCost,
    supplierUrl: product.supplierUrl,
  });

  if (variant?.id) {
    await db
      .update(productVariants)
      .set({ inventoryCount: Math.max(0, variant.inventoryCount - qty) })
      .where(eq(productVariants.id, variant.id));
  }

  await logActivity(db, {
    kind: "order",
    message: `Practice order ${orderNumber} created for smoke test (not a real payment).`,
    href: `/orders/${id}`,
  });

  revalidatePath("/orders");
  revalidatePath("/fulfillment");
  revalidatePath("/");
  return {
    ok: true as const,
    orderId: id,
    orderNumber,
    productTitle: product.cleanTitle || product.rawTitle,
  };
}
