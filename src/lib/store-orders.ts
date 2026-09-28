import "server-only";

import { eq } from "drizzle-orm";
import { ensureDb } from "./db";
import { getOperator } from "./db/queries";
import { orderItems, orders, productVariants, products, settings } from "./db/schema";
import { netProfit, processorFee } from "./money";
import { nid, nowIso } from "./utils";
import { logActivity } from "./db/seed";
import { stripeGet } from "./stripe";
import { validateStoreQty } from "./store-qty";
import { deliveryWindow } from "./delivery";
import { mailingLabel } from "./fulfillment-copy";
import { loadCheckoutMerchant, resolveMerchantStripeSecret } from "./merchant-stripe";

export type StoreReceipt = {
  id: string;
  orderNumber: string;
  items: Array<{ title: string; qty: number; unitPrice: number }>;
  deliveryText: string;
};

async function loadStoreReceipt(orderId: string): Promise<StoreReceipt | null> {
  const db = await ensureDb();
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return null;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    items: items.map((item) => ({ title: item.title, qty: item.quantity, unitPrice: item.unitPrice })),
    deliveryText: deliveryWindow().text,
  };
}

export type PendingStoreLine = {
  productId: string;
  variantId: string;
  merchantId: string;
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

export class StoreCheckoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoreCheckoutError";
  }
}

export async function resolveStoreLines(
  input: Array<{ productId: string; variantId: string; qty: number }>,
): Promise<PendingStoreLine[]> {
  const db = await ensureDb();
  const { shopperVariantLabel } = await import("./shopper-copy");
  const lines: PendingStoreLine[] = [];
  for (const item of input) {
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
    const stock = variant?.inventoryCount ?? 0;
    const qtyCheck = validateStoreQty(Number(item.qty), stock);
    if (!qtyCheck.ok) throw new StoreCheckoutError(qtyCheck.error);
    const qty = qtyCheck.qty;
    const option = variant ? shopperVariantLabel(variant.variantName) : "";
    if (lines.length && lines[0].merchantId !== product.userId) {
      throw new StoreCheckoutError("Pay for one shop at a time.");
    }
    lines.push({
      productId: product.id,
      variantId: variant?.id ?? "default",
      merchantId: product.userId,
      title: option
        ? `${product.cleanTitle ?? product.rawTitle} · ${option}`
        : (product.cleanTitle ?? product.rawTitle),
      sku: variant?.supplierSkuId ?? product.id,
      qty,
      unitPrice,
      unitCost: (variant?.variantCost ?? product.baseCost) + product.shippingCost,
      supplierUrl: product.supplierUrl,
    });
  }
  return lines;
}

export async function fulfillStoreCheckout(sessionId: string): Promise<StoreReceipt | null> {
  if (!sessionId) return null;
  const db = await ensureDb();
  const [existing] = await db.select({ id: orders.id }).from(orders).where(eq(orders.shopifyOrderId, sessionId)).limit(1);
  if (existing) return loadStoreReceipt(existing.id);

  const mappedMerchantId = await loadCheckoutMerchant(sessionId);
  const secret = await resolveMerchantStripeSecret(mappedMerchantId);
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
  }>(`checkout/sessions/${sessionId}`, secret);

  if (session.metadata?.kind !== "store_order") return null;
  if (session.payment_status && session.payment_status !== "paid") return null;

  const cartId = session.metadata.cartId ?? "";
  const lines = await loadPendingStoreCart(cartId);
  if (!lines.length) return null;

  const merchantId = lines[0]?.merchantId || mappedMerchantId;
  const operator = merchantId
    ? await (await import("./db/queries")).getUserById(merchantId)
    : await getOperator();
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
  const customerName = session.shipping_details?.name || session.customer_details?.name || "Customer";
  const shippingAddress = mailingLabel(customerName, address).split("\n").slice(-1)[0] || address;

  const id = nid("ord");
  try {
  await db.insert(orders).values({
    id,
    userId: operator.id,
    shopifyOrderId: session.id || sessionId,
    orderNumber: `S-${sessionId.slice(-6).toUpperCase()}`,
    customerName,
    customerEmail: session.customer_details?.email || "unknown@store",
    shippingAddress,
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
    if (line.variantId && line.variantId !== "default") {
      const [current] = await db
        .select({ inventoryCount: productVariants.inventoryCount })
        .from(productVariants)
        .where(eq(productVariants.id, line.variantId))
        .limit(1);
      if (current) {
        await db
          .update(productVariants)
          .set({ inventoryCount: Math.max(0, current.inventoryCount - line.qty) })
          .where(eq(productVariants.id, line.variantId));
      }
    }
  }

  await db.delete(settings).where(eq(settings.key, `store_cart_${cartId}`));
  await logActivity(db, {
    kind: "order",
    message: `Store checkout ${session.customer_details?.email || "a customer"} paid ${revenue.toFixed(2)}.`,
    href: "/orders",
  });
  return loadStoreReceipt(id);
  } catch {
    const [again] = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.shopifyOrderId, sessionId))
      .limit(1);
    return again ? loadStoreReceipt(again.id) : null;
  }
}
