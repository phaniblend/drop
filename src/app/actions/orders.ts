"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { toCsv } from "@/lib/csv";
import { ensureDb } from "@/lib/db";
import { getOrder, listOrders, requireOperator } from "@/lib/db/queries";
import { orders, refunds } from "@/lib/db/schema";
import { nid, nowIso } from "@/lib/utils";
import { logActivity } from "@/lib/db/seed";

export async function markOrdersPlaced(orderIds: string[], supplierOrderId: string) {
  if (!orderIds.length) throw new Error("Select at least one order.");
  const db = await ensureDb();
  await db
    .update(orders)
    .set({
      fulfillmentStatus: "ordered_supplier",
      supplierOrderId: supplierOrderId || `SUP-${Date.now().toString().slice(-6)}`,
    })
    .where(inArray(orders.id, orderIds));
  await logActivity(db, {
    kind: "fulfillment",
    message: `Placed ${orderIds.length} supplier order${orderIds.length === 1 ? "" : "s"}.`,
    href: "/orders",
  });
  revalidatePath("/orders");
  revalidatePath("/fulfillment");
  revalidatePath("/");
}

export async function attachTracking(orderId: string, trackingNumber: string, carrier: string) {
  const db = await ensureDb();
  await db
    .update(orders)
    .set({
      trackingNumber: trackingNumber.trim(),
      carrier: carrier.trim() || "YunExpress",
      fulfillmentStatus: "shipped",
    })
    .where(eq(orders.id, orderId));
  await logActivity(db, {
    kind: "tracking",
    message: `Tracking ${trackingNumber} saved.`,
    href: "/orders",
  });
  revalidatePath("/orders");
  revalidatePath("/fulfillment");
  revalidatePath("/ops");
  revalidatePath("/");
}

export async function bulkTracking(rows: Array<{ orderId: string; tracking: string; carrier: string }>) {
  for (const row of rows) {
    if (!row.tracking.trim()) continue;
    await attachTracking(row.orderId, row.tracking, row.carrier);
  }
}

export async function requestOrderRefund(orderId: string, reason = "Seller started a refund") {
  const operator = await requireOperator();
  const order = await getOrder(orderId);
  if (!order || order.userId !== operator.id) throw new Error("Order not found.");
  const db = await ensureDb();
  await db.insert(refunds).values({
    id: nid("ref"),
    orderId: order.id,
    reason,
    amount: order.totalRevenue,
    status: "open",
    createdAt: nowIso(),
  });
  await db.update(orders).set({ fulfillmentStatus: "refunded" }).where(eq(orders.id, order.id));
  await logActivity(db, {
    kind: "order",
    message: `Refund opened for ${order.orderNumber}.`,
    href: `/orders/${order.id}`,
  });
  revalidatePath("/orders");
  revalidatePath(`/orders/${order.id}`);
  revalidatePath("/ops");
  revalidatePath("/");
  return { ok: true as const };
}

export async function setOrderStatus(orderId: string, status: string) {
  const db = await ensureDb();
  await db.update(orders).set({ fulfillmentStatus: status }).where(eq(orders.id, orderId));
  revalidatePath("/orders");
  revalidatePath("/fulfillment");
  revalidatePath("/");
}

export async function fulfillmentCsv() {
  const pending = await listOrders("pending_batch");
  return toCsv(
    [
      "order_number",
      "customer_name",
      "shipping_address",
      "sku",
      "title",
      "qty",
      "unit_cost",
      "supplier_url",
    ],
    pending.flatMap((o) =>
      o.items.map((item) => [
        o.orderNumber,
        o.customerName,
        o.shippingAddress,
        item.sku,
        item.title,
        item.quantity,
        item.unitCost,
        item.supplierUrl,
      ]),
    ),
  );
}
