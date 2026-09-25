import "server-only";

import { eq } from "drizzle-orm";
import { ensureDb } from "./db";
import { getOperator } from "./db/queries";
import { orderItems, orders, productVariants, products, settings } from "./db/schema";
import { netProfit, processorFee } from "./money";
import { nid, nowIso } from "./utils";
import { logActivity } from "./db/seed";
import { stripeGet } from "./stripe";

export type PendingStoreLine = {
  productId: string;
  variantId: string;
  title: string;
  sku: string;
  qty: number;
  unitPrice: number;
  unitCost: number;
  supplierUrl?: string;
};

export async function savePendingStoreCart(cartId: string, lines: PendingStoreLine[]) {
  const db = await ensureDb();
  await db.delete(settings).where(eq(settings.key, `store_cart_${cartId}`));
  await db.insert(settings).values({
    key: `store_cart_${cartId}`,
    value: JSON.stringify(lines),
  });
}

export async function loadPendingStoreCart(cartId: string): Promise<PendingStoreLine[]> {
  const db = await ensureDb();
  const [row] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, `store_cart_${cartId}`))
    .limit(1);
  if (!row) return [];
  try {
    const parsed = JSON.parse(row.value) as PendingStoreLine[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function resolveStoreLines(
  input: Array<{ productId: string; variantId: string; qty: number }>,
): Promise<PendingStoreLine[]> {
  const db = await ensureDb();
  const lines: PendingStoreLine[] = [];
  for (const item of input) {
    const qty = Math.max(1, Math.min(20, Math.round(item.qty || 1)));
    const [product] = await db.select().from(products).where(eq(products.id, item.productId)).limit(1);
    if (!product || product.status !== "published") continue;
    const variants = await db
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, product.id));
    const variant =
      variants.find((row) => row.id === item.variantId) ??
      variants[0] ??
      null;
    const unitPrice = variant?.variantPrice || product.retailPrice;
    if (unitPrice <= 0) continue;
    lines.push({
      productId: product.id,
      variantId: variant?.id ?? "default",
      title: `${product.cleanTitle ?? product.rawTitle}${variant ? ` · ${variant.variantName}` : ""}`,
      sku: variant?.supplierSkuId ?? product.id,
      qty,
      unitPrice,
      unitCost: (variant?.variantCost ?? product.baseCost) + product.shippingCost,
      supplierUrl: product.supplierUrl,
    });
  }
  return lines;
}

export async function fulfillStoreCheckout(sessionId: string) {
  if (!sessionId) return null;
  const db = await ensureDb();
  const [existing] = await db.select({ id: orders.id }).from(orders).where(eq(orders.shopifyOrderId, sessionId)).limit(1);
  if (existing) return existing.id;

  const session = await stripeGet<{
    id?: string;
    payment_status?: string;
    amount_total?: number;
    metadata?: { kind?: string; cartId?: string };
    customer_details?: { email?: string; name?: string };
    shipping_details?: {
      name?: string;
      address?: {
        line1?: string;
        city?: string;
        state?: string;
        postal_code?: string;
        country?: string;
      };
    };
  }>(`checkout/sessions/${sessionId}`);

  if (session.metadata?.kind !== "store_order") return null;
  if (session.payment_status && session.payment_status !== "paid") return null;

  const cartId = session.metadata.cartId ?? "";
  const lines = await loadPendingStoreCart(cartId);
  if (!lines.length) return null;

  const operator = await getOperator();
  if (!operator) throw new Error("Store is not claimed yet.");

  const revenue = lines.reduce((sum, line) => sum + line.unitPrice * line.qty, 0);
  const cogs = lines.reduce((sum, line) => sum + line.unitCost * line.qty, 0);
  const fee = processorFee(revenue);
  const address = session.shipping_details?.address
    ? [
        session.shipping_details.address.line1,
        session.shipping_details.address.city,
        session.shipping_details.address.state,
        session.shipping_details.address.postal_code,
        session.shipping_details.address.country,
      ]
        .filter(Boolean)
        .join(", ")
    : "Address pending";

  const id = nid("ord");
  try {
  await db.insert(orders).values({
    id,
    userId: operator.id,
    shopifyOrderId: session.id || sessionId,
    orderNumber: `S-${sessionId.slice(-6).toUpperCase()}`,
    customerName: session.shipping_details?.name || session.customer_details?.name || "Customer",
    customerEmail: session.customer_details?.email || "unknown@store",
    shippingAddress: address,
    totalRevenue: revenue,
    totalCogs: cogs,
    paymentFee: fee,
    netMargin: netProfit({ revenue, cogs }),
    fulfillmentStatus: "pending_batch",
    createdAt: nowIso(),
  });

  for (const line of lines) {
    await db.insert(orderItems).values({
      id: nid("itm"),
      orderId: id,
      productId: line.productId,
      variantId: line.variantId,
      title: line.title,
      sku: line.sku,
      quantity: line.qty,
      unitPrice: line.unitPrice,
      unitCost: line.unitCost,
      supplierUrl: line.supplierUrl,
    });
  }

  await db.delete(settings).where(eq(settings.key, `store_cart_${cartId}`));
  await logActivity(db, {
    kind: "order",
    message: `Store checkout ${session.customer_details?.email || "a customer"} paid ${revenue.toFixed(2)}.`,
    href: "/orders",
  });
  return id;
  } catch {
    const [again] = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.shopifyOrderId, sessionId))
      .limit(1);
    return again?.id ?? null;
  }
}
