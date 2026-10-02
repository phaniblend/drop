import { eq } from "drizzle-orm";
import {
  adAttributions,
  complianceRequests,
  shopifyConnections,
  shopifyLineItems,
  shopifyOrders,
  shopifyRefunds,
  storeFinanceConfigs,
  variantCosts,
  webhookEvents,
} from "../db/schema-guard";
import { nid, nowIso } from "../utils";
import { asOrderGid } from "./gid";
import { markShopUninstalled, syncOrder, type FetchOrder } from "./sync-order";

type Db = Awaited<ReturnType<typeof import("@/lib/db").ensureDb>>;

const ORDER_TOPICS = new Set(["orders/create", "orders/paid", "orders/updated", "orders/cancelled"]);

export async function processWebhook(
  dedupeKey: string,
  opts: { db: Db; fetchOrder?: FetchOrder },
) {
  const [ev] = await opts.db.select().from(webhookEvents).where(eq(webhookEvents.dedupeKey, dedupeKey)).limit(1);
  if (!ev) return { ok: false, reason: "missing" };
  if (ev.status === "PROCESSED") return { ok: true, reason: "already" };

  try {
    if (ORDER_TOPICS.has(ev.topic) && ev.resourceGid) {
      await syncOrder(ev.shopDomain, ev.resourceGid, opts);
    } else if (ev.topic === "refunds/create") {
      await syncOrder(ev.shopDomain, ev.resourceGid || asOrderGid(ev.resourceGid), opts);
    } else if (ev.topic === "app/uninstalled") {
      await markShopUninstalled(opts.db, ev.shopDomain);
    }
    await opts.db
      .update(webhookEvents)
      .set({ status: "PROCESSED", processedAt: nowIso(), lastError: null })
      .where(eq(webhookEvents.dedupeKey, dedupeKey));
    return { ok: true };
  } catch (error) {
    await opts.db
      .update(webhookEvents)
      .set({
        status: "FAILED",
        lastError: error instanceof Error ? error.message : "process failed",
        attempts: ev.attempts + 1,
      })
      .where(eq(webhookEvents.dedupeKey, dedupeKey));
    return { ok: false, reason: "failed" };
  }
}

export async function processCompliance(
  input: {
    topic: string;
    shopDomain: string;
    payload: Record<string, unknown>;
  },
  db: Db,
) {
  const now = nowIso();
  const due = new Date(Date.now() + 30 * 24 * 3600_000).toISOString();
  const customer = input.payload.customer as { id?: string | number } | undefined;
  const orders = (input.payload.orders_requested as Array<string | number> | undefined) ?? [];
  const id = nid("cmp");
  await db.insert(complianceRequests).values({
    id,
    topic: input.topic,
    shopDomain: input.shopDomain,
    shopifyCustomerId: customer?.id != null ? String(customer.id) : null,
    ordersRequestedJson: JSON.stringify(orders.map(String)),
    payloadJson: JSON.stringify(input.payload),
    receivedAtUtc: now,
    dueByUtc: due,
  });

  if (input.topic === "customers/data_request") {
    await db
      .update(complianceRequests)
      .set({ completedAtUtc: now, payloadJson: JSON.stringify({ note: "no customer PII stored" }) })
      .where(eq(complianceRequests.id, id));
    return { id, action: "none" as const };
  }

  if (input.topic === "customers/redact") {
    const gids = orders.map((order) => (String(order).startsWith("gid://") ? String(order) : `gid://shopify/Order/${order}`));
    for (const gid of gids) {
      await db
        .update(shopifyOrders)
        .set({ customerIdHash: null, landingSite: null, referringSite: null })
        .where(eq(shopifyOrders.id, gid));
    }
    await db
      .update(complianceRequests)
      .set({ completedAtUtc: now, payloadJson: "{}" })
      .where(eq(complianceRequests.id, id));
    return { id, action: "redact-customer" as const };
  }

  if (input.topic === "shop/redact") {
    const accessStore = await db
      .select()
      .from(shopifyConnections)
      .where(eq(shopifyConnections.shopDomain, input.shopDomain))
      .limit(1);
    const storeId = accessStore[0]?.storeId;
    if (storeId) {
      const orderRows = await db.select({ id: shopifyOrders.id }).from(shopifyOrders).where(eq(shopifyOrders.storeId, storeId));
      for (const order of orderRows) {
        await db.delete(adAttributions).where(eq(adAttributions.orderId, order.id));
        await db.delete(shopifyLineItems).where(eq(shopifyLineItems.orderId, order.id));
        await db.delete(shopifyRefunds).where(eq(shopifyRefunds.orderId, order.id));
      }
      await db.delete(shopifyOrders).where(eq(shopifyOrders.storeId, storeId));
      await db.delete(variantCosts).where(eq(variantCosts.storeId, storeId));
      await db.delete(storeFinanceConfigs).where(eq(storeFinanceConfigs.storeId, storeId));
    }
    await db.delete(shopifyConnections).where(eq(shopifyConnections.shopDomain, input.shopDomain));
    await db.delete(webhookEvents).where(eq(webhookEvents.shopDomain, input.shopDomain));
    await db
      .update(complianceRequests)
      .set({ completedAtUtc: now, payloadJson: "{}" })
      .where(eq(complianceRequests.id, id));
    return { id, action: "redact-shop" as const };
  }

  return { id, action: "recorded" as const };
}
