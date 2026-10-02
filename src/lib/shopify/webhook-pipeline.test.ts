import { createHmac } from "node:crypto";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import * as core from "../db/schema";
import * as guard from "../db/schema-guard";
import { MARGIN_GUARD_DDL } from "../db/margin-guard-ddl";
import { shopifyOrders, webhookEvents } from "../db/schema-guard";
import { users } from "../db/schema";
import { ingestShopifyWebhook } from "./webhook-ingress";
import { processWebhook } from "./webhook-worker";
import type { ShopifyOrderNode } from "./order-query";

const schema = { ...core, ...guard };

async function memoryDb() {
  const client = createClient({ url: ":memory:" });
  await client.executeMultiple(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL DEFAULT 'Operator',
      store_name TEXT NOT NULL DEFAULT 'SetoStore',
      store_slug TEXT,
      shopify_domain TEXT,
      shopify_access_token TEXT,
      meta_access_token TEXT,
      tiktok_access_token TEXT,
      markup_multiplier REAL NOT NULL DEFAULT 3,
      spend_limit_threshold REAL NOT NULL DEFAULT 50,
      min_roas_threshold REAL NOT NULL DEFAULT 1.2,
      fee_rate REAL NOT NULL DEFAULT 0.029,
      fee_fixed REAL NOT NULL DEFAULT 0.3,
      timezone TEXT NOT NULL DEFAULT 'UTC',
      sentinel_settings TEXT NOT NULL DEFAULT '{}',
      dayparting_enabled INTEGER NOT NULL DEFAULT 0,
      subscription_tier TEXT NOT NULL DEFAULT 'trial_5',
      subscription_status TEXT NOT NULL DEFAULT 'active',
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      store_stripe_pk TEXT,
      store_stripe_sk TEXT,
      support_email TEXT,
      business_address TEXT,
      meta_pixel_id TEXT,
      products_imported_count INTEGER NOT NULL DEFAULT 0,
      lens_searches_count INTEGER NOT NULL DEFAULT 0,
      billing_cycle_start TEXT,
      billing_cycle_end TEXT,
      created_at TEXT NOT NULL
    );
    ${MARGIN_GUARD_DDL}
  `);
  const db = drizzle(client, { schema });
  await db.insert(users).values({
    id: "usr_1",
    email: "op@test.com",
    displayName: "Op",
    storeName: "Shop",
    shopifyDomain: "test",
    shopifyAccessToken: "tok",
    createdAt: "2026-01-01T00:00:00.000Z",
  });
  return db;
}

function signed(raw: string, secret: string, extra: Record<string, string> = {}) {
  return {
    rawBody: raw,
    secret,
    headers: {
      "x-shopify-hmac-sha256": createHmac("sha256", secret).update(raw, "utf8").digest("base64"),
      "x-shopify-topic": "orders/paid",
      "x-shopify-shop-domain": "test.myshopify.com",
      "x-shopify-event-id": "evt_1",
      ...extra,
    },
  };
}

function mockOrder(updatedAt: string, name: string): ShopifyOrderNode {
  return {
    id: "gid://shopify/Order/1042",
    name,
    test: false,
    createdAt: "2026-09-28T10:00:00Z",
    processedAt: "2026-09-28T10:00:00Z",
    cancelledAt: null,
    updatedAt,
    displayFinancialStatus: "PAID",
    paymentGatewayNames: ["shopify_payments"],
    currentSubtotalPriceSet: { shopMoney: { amount: "20.00", currencyCode: "USD" } },
    totalDiscountsSet: { shopMoney: { amount: "0.00" } },
    totalShippingPriceSet: { shopMoney: { amount: "0.00" } },
    totalTaxSet: { shopMoney: { amount: "0.00" } },
    totalPriceSet: { shopMoney: { amount: "20.00" } },
    totalRefundedSet: { shopMoney: { amount: "0.00" } },
    customer: { id: "gid://shopify/Customer/9" },
    lineItems: {
      nodes: [
        {
          id: "gid://shopify/LineItem/1",
          quantity: 1,
          currentQuantity: 1,
          sku: "SKU-1",
          originalUnitPriceSet: { shopMoney: { amount: "20.00" } },
          totalDiscountSet: { shopMoney: { amount: "0.00" } },
        },
      ],
    },
    refunds: [],
  };
}

describe("Shopify webhook pipeline", () => {
  const secret = "shpss_test_secret";
  const raw = JSON.stringify({ id: 1042, admin_graphql_api_id: "gid://shopify/Order/1042" });

  it("returns 401 with an invalid HMAC and 200 with a valid HMAC", async () => {
    const db = await memoryDb();
    const bad = await ingestShopifyWebhook({
      rawBody: raw,
      secret,
      db,
      headers: { "x-shopify-hmac-sha256": "nope", "x-shopify-topic": "orders/paid", "x-shopify-shop-domain": "test.myshopify.com", "x-shopify-event-id": "evt_bad" },
    });
    expect(bad.status).toBe(401);
    const good = await ingestShopifyWebhook({ ...signed(raw, secret), db });
    expect(good.status).toBe(200);
    expect(good.body).toBe("ok");
  });

  it("dedupes identical deliveries and queues once", async () => {
    const db = await memoryDb();
    const first = await ingestShopifyWebhook({ ...signed(raw, secret), db });
    const second = await ingestShopifyWebhook({ ...signed(raw, secret), db });
    expect(first.inserted).toBe(true);
    expect(second.body).toBe("duplicate");
    expect(second.inserted).toBe(false);
    const rows = await db.select().from(webhookEvents);
    expect(rows).toHaveLength(1);
    let runs = 0;
    if (first.inserted && first.dedupeKey) {
      runs += 1;
      await processWebhook(first.dedupeKey, { db, fetchOrder: async () => mockOrder("2026-09-28T12:00:00Z", "#1042") });
    }
    if (second.inserted && second.dedupeKey) {
      runs += 1;
      await processWebhook(second.dedupeKey, { db, fetchOrder: async () => mockOrder("2026-09-28T12:00:00Z", "#1042") });
    }
    expect(runs).toBe(1);
  });

  it("keeps the newer order when paid arrives before create", async () => {
    const db = await memoryDb();
    const paid = await ingestShopifyWebhook({
      ...signed(raw, secret, { "x-shopify-event-id": "evt_paid", "x-shopify-topic": "orders/paid" }),
      db,
    });
    await processWebhook(paid.dedupeKey!, {
      db,
      fetchOrder: async () => mockOrder("2026-09-28T12:00:00Z", "#1042-paid"),
    });
    const created = await ingestShopifyWebhook({
      ...signed(raw, secret, { "x-shopify-event-id": "evt_create", "x-shopify-topic": "orders/create" }),
      db,
    });
    await processWebhook(created.dedupeKey!, {
      db,
      fetchOrder: async () => mockOrder("2026-09-28T11:00:00Z", "#1042-create"),
    });
    const [order] = await db.select().from(shopifyOrders).where(eq(shopifyOrders.id, "gid://shopify/Order/1042"));
    expect(order?.name).toBe("#1042-paid");
    expect(order?.shopifyUpdatedAt).toBe("2026-09-28T12:00:00Z");
  });
});
