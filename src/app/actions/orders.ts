"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { toCsv } from "@/lib/csv";
import { ensureDb } from "@/lib/db";
import { getOrder, listOrders, requireOperator } from "@/lib/db/queries";
import { orderItems, orders, refunds } from "@/lib/db/schema";
import { nid, nowIso } from "@/lib/utils";
import { logActivity } from "@/lib/db/seed";
import { validateSupplierOrderId, validateTracking } from "@/lib/fulfillment-validate";
import { isPracticeOrder } from "@/lib/practice-order";

export async function markOrdersPlaced(orderIds: string[], supplierOrderId: string) {
  if (!orderIds.length) throw new Error("Select at least one order.");
  const operator = await requireOperator();
  const rows = await Promise.all(orderIds.map((id) => getOrder(id)));
  const owned = rows.filter((o) => o && o.userId === operator.id);
  if (owned.length !== orderIds.length) throw new Error("Order not found.");
  const allPractice = owned.every((o) => o && isPracticeOrder(o));
  const check = validateSupplierOrderId(supplierOrderId, { practice: allPractice });
  if (!check.ok) throw new Error(check.error);
  const db = await ensureDb();
  await db
    .update(orders)
    .set({
      fulfillmentStatus: "ordered_supplier",
      supplierOrderId: check.value,
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
  const check = validateTracking(trackingNumber, carrier);
  if (!check.ok) throw new Error(check.error);
  const db = await ensureDb();
  await db
    .update(orders)
    .set({
      trackingNumber: check.tracking,
      carrier: check.carrier,
      fulfillmentStatus: "shipped",
    })
    .where(eq(orders.id, orderId));
  await logActivity(db, {
    kind: "tracking",
    message: `Tracking ${check.tracking} saved.`,
    href: "/orders",
  });
  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/fulfillment");
  revalidatePath("/ops");
  revalidatePath("/");
}

export async function updateOrderFulfillment(
  orderId: string,
  input: {
    supplierOrderId?: string;
    trackingNumber?: string;
    carrier?: string;
    fulfillmentStatus?: string;
  },
) {
  const operator = await requireOperator();
  const order = await getOrder(orderId);
  if (!order || order.userId !== operator.id) throw new Error("Order not found.");

  const patch: Partial<{
    supplierOrderId: string | null;
    trackingNumber: string | null;
    carrier: string | null;
    fulfillmentStatus: string;
  }> = {};

  if (input.supplierOrderId !== undefined) {
    const check = validateSupplierOrderId(input.supplierOrderId, {
      practice: isPracticeOrder(order),
    });
    if (!check.ok) throw new Error(check.error);
    patch.supplierOrderId = check.value;
  }

  if (input.trackingNumber !== undefined || input.carrier !== undefined) {
    const tracking = input.trackingNumber ?? order.trackingNumber ?? "";
    const carrier = input.carrier ?? order.carrier ?? "";
    if (tracking.trim() || carrier.trim()) {
      const check = validateTracking(tracking, carrier);
      if (!check.ok) throw new Error(check.error);
      patch.trackingNumber = check.tracking;
      patch.carrier = check.carrier;
    } else {
      patch.trackingNumber = null;
      patch.carrier = null;
    }
  }

  if (input.fulfillmentStatus !== undefined) {
    const allowed = new Set([
      "pending_batch",
      "ordered_supplier",
      "shipped",
      "delivered",
      "refunded",
    ]);
    if (!allowed.has(input.fulfillmentStatus)) throw new Error("Invalid fulfillment status.");
    patch.fulfillmentStatus = input.fulfillmentStatus;
    if (input.fulfillmentStatus === "pending_batch") {
      patch.supplierOrderId = null;
      patch.trackingNumber = null;
      patch.carrier = null;
    } else if (input.fulfillmentStatus === "ordered_supplier") {
      patch.trackingNumber = null;
      patch.carrier = null;
      if (!patch.supplierOrderId && !order.supplierOrderId) {
        throw new Error("Enter the supplier order id before marking placed.");
      }
    }
  }

  const db = await ensureDb();
  await db.update(orders).set(patch).where(eq(orders.id, orderId));
  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/fulfillment");
  revalidatePath("/ops");
  revalidatePath("/");
  return { ok: true as const };
}

export async function deletePracticeOrder(orderId: string) {
  const operator = await requireOperator();
  const order = await getOrder(orderId);
  if (!order || order.userId !== operator.id) throw new Error("Order not found.");
  if (!isPracticeOrder(order)) throw new Error("Only practice orders can be deleted this way.");
  const db = await ensureDb();
  await db.delete(orderItems).where(eq(orderItems.orderId, orderId));
  await db.delete(refunds).where(eq(refunds.orderId, orderId));
  await db.delete(orders).where(eq(orders.id, orderId));
  await logActivity(db, {
    kind: "order",
    message: `Deleted practice order ${order.orderNumber}.`,
    href: "/orders",
  });
  revalidatePath("/orders");
  revalidatePath("/fulfillment");
  revalidatePath("/");
  return { ok: true as const };
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
