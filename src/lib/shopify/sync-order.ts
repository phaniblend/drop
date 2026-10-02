import { and, eq, lte, or, isNull } from "drizzle-orm";
import { campaignTrackers, users } from "../db/schema";
import {
  adAttributions,
  guardStates,
  metaEntities,
  shopifyConnections,
  shopifyLineItems,
  shopifyOrders,
  shopifyRefunds,
  storeFinanceConfigs,
  variantCosts,
} from "../db/schema-guard";
import { decryptSecret } from "../crypto";
import { nid, nowIso, todayKey } from "../utils";
import { matchAttribution } from "./attribution";
import { resolveUnitCost, type CostSource } from "./cogs";
import { recomputeOrderEconomics, shouldSkipStale } from "./economics";
import { hashCustomerId, normalizeShopDomainHost } from "./gid";
import { moneyAmount, ORDER_QUERY, type ShopifyOrderNode } from "./order-query";

type Db = Awaited<ReturnType<typeof import("@/lib/db").ensureDb>>;

export type FetchOrder = (shopDomain: string, orderGid: string, token: string) => Promise<ShopifyOrderNode | null>;

export function shopifyApiHost(shopDomain: string) {
  const host = shopDomain.includes(".") ? shopDomain : `${shopDomain}.myshopify.com`;
  return host.replace(/^https?:\/\//, "");
}

export async function fetchShopifyOrder(
  shopDomain: string,
  orderGid: string,
  token: string,
): Promise<ShopifyOrderNode | null> {
  const res = await fetch(`https://${shopifyApiHost(shopDomain)}/admin/api/2026-07/graphql.json`, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: ORDER_QUERY, variables: { id: orderGid } }),
  });
  if (!res.ok) throw new Error(`Shopify order read failed (${res.status}).`);
  const json = (await res.json()) as { data?: { order?: ShopifyOrderNode | null } };
  return json.data?.order ?? null;
}

export async function resolveShopAccess(db: Db, shopDomain: string) {
  const host = normalizeShopDomainHost(shopDomain);
  const full = `${host}.myshopify.com`;
  const [conn] = await db
    .select()
    .from(shopifyConnections)
    .where(eq(shopifyConnections.shopDomain, full))
    .limit(1);
  if (conn) {
    return {
      storeId: conn.storeId,
      token: decryptSecret(conn.accessTokenEnc),
      timezone: conn.ianaTimezone,
      currency: conn.currency,
      status: conn.status,
    };
  }
  const [user] = await db.select().from(users).where(eq(users.shopifyDomain, host)).limit(1);
  if (!user?.shopifyAccessToken) return null;
  return {
    storeId: user.id,
    token: user.shopifyAccessToken,
    timezone: user.timezone || "UTC",
    currency: "USD",
    status: "ACTIVE",
  };
}

export async function markShopUninstalled(db: Db, shopDomain: string) {
  const access = await resolveShopAccess(db, shopDomain);
  const host = `${normalizeShopDomainHost(shopDomain)}.myshopify.com`;
  const now = nowIso();
  await db
    .update(shopifyConnections)
    .set({ status: "UNINSTALLED", uninstalledAt: now, updatedAt: now })
    .where(eq(shopifyConnections.shopDomain, host));
  if (!access) return;
  await db.update(guardStates).set({ state: "BLOCKED", updatedAt: now }).where(eq(guardStates.storeId, access.storeId));
  const { products } = await import("../db/schema");
  const mine = await db
    .select({ id: campaignTrackers.id })
    .from(campaignTrackers)
    .innerJoin(products, eq(campaignTrackers.productId, products.id))
    .where(eq(products.userId, access.storeId));
  for (const row of mine) {
    await db
      .update(campaignTrackers)
      .set({ isPaused: true, pauseReason: "Shopify uninstalled", pauseSource: "shopify" })
      .where(eq(campaignTrackers.id, row.id));
  }
}

export async function syncOrder(
  shopDomain: string,
  orderGid: string,
  opts: { db: Db; fetchOrder?: FetchOrder } = { db: null as unknown as Db },
) {
  const db = opts.db;
  const access = await resolveShopAccess(db, shopDomain);
  if (!access || access.status === "UNINSTALLED") return { skipped: true as const, reason: "no-shop" };
  const fetchOrder = opts.fetchOrder ?? fetchShopifyOrder;
  const node = await fetchOrder(shopDomain, orderGid, access.token);
  if (!node?.id) return { skipped: true as const, reason: "missing" };

  const [existing] = await db.select().from(shopifyOrders).where(eq(shopifyOrders.id, node.id)).limit(1);
  if (shouldSkipStale(existing?.shopifyUpdatedAt, node.updatedAt || existing?.shopifyUpdatedAt || nowIso())) {
    return { skipped: true as const, reason: "stale" };
  }

  const [finance] =
    (await db.select().from(storeFinanceConfigs).where(eq(storeFinanceConfigs.storeId, access.storeId)).limit(1)) ?? [];
  const feePct = finance?.paymentFeePct ?? 0.029;
  const fixedFee = finance?.paymentFixedFee ?? 0.3;
  const fxPct = finance?.currencyConversionPct ?? 0;
  const defaultShip = finance?.defaultShippingCost ?? 0;
  const defaultPct = finance?.defaultCogsPctOfPrice ?? null;

  const processedAt = node.processedAt || node.createdAt || nowIso();
  const createdAt = node.createdAt || processedAt;
  const refundQtyByLine = new Map<string, number>();
  for (const refund of node.refunds ?? []) {
    for (const item of refund.refundLineItems?.nodes ?? []) {
      const lineId = item.lineItem?.id;
      if (!lineId) continue;
      refundQtyByLine.set(lineId, (refundQtyByLine.get(lineId) ?? 0) + (item.quantity ?? 0));
    }
  }

  const costRows = await db
    .select()
    .from(variantCosts)
    .where(
      and(
        eq(variantCosts.storeId, access.storeId),
        or(isNull(variantCosts.effectiveTo), lte(variantCosts.effectiveFrom, processedAt)),
      ),
    );

  const lines = (node.lineItems?.nodes ?? []).map((line) => {
    const unitPrice = moneyAmount(line.originalUnitPriceSet);
    const qty = line.quantity ?? 0;
    const remain = line.currentQuantity ?? qty;
    const refundedQuantity = refundQtyByLine.get(line.id) ?? Math.max(0, qty - remain);
    const variantRows = costRows
      .filter((row) => row.shopifyVariantId === (line.variant?.id ?? ""))
      .map((row) => ({
        unitCogs: row.unitCogs,
        unitShippingCost: row.unitShippingCost,
        source: row.source as CostSource,
        effectiveFrom: row.effectiveFrom,
        effectiveTo: row.effectiveTo,
      }));
    const resolved = resolveUnitCost(variantRows, processedAt, unitPrice, {
      defaultShippingCost: defaultShip,
      defaultCogsPctOfPrice: defaultPct,
    });
    return {
      id: line.id,
      shopifyProductId: line.variant?.product?.id ?? null,
      shopifyVariantId: line.variant?.id ?? null,
      sku: line.sku ?? null,
      quantity: qty,
      refundedQuantity,
      unitPrice,
      totalDiscount: moneyAmount(line.totalDiscountSet),
      unitCogsSnapshot: resolved?.cogs ?? null,
      unitShipSnapshot: resolved?.ship ?? null,
      costSourceSnapshot: resolved?.source ?? null,
    };
  });

  const refunds = (node.refunds ?? []).map((refund) => ({
    id: refund.id,
    createdAtUtc: refund.createdAt || processedAt,
    amount: moneyAmount(refund.totalRefundedSet),
    restockedQty: (refund.refundLineItems?.nodes ?? []).reduce(
      (sum, item) => sum + (item.restockType && item.restockType !== "NO_RESTOCK" ? item.quantity ?? 0 : 0),
      0,
    ),
  }));

  const econ = recomputeOrderEconomics({
    cancelled: Boolean(node.cancelledAt),
    lines,
    shippingCharged: moneyAmount(node.totalShippingPriceSet),
    totalPrice: moneyAmount(node.totalPriceSet),
    refundedMoney: moneyAmount(node.totalRefundedSet) || refunds.reduce((s, r) => s + r.amount, 0),
    feePct,
    currencyConversionPct: fxPct,
    fixedFee,
  });

  const first = node.customerJourneySummary?.firstVisit;
  const last = node.customerJourneySummary?.lastVisit;
  const customerGid = node.customer?.id;
  const now = nowIso();
  const row = {
    id: node.id,
    storeId: access.storeId,
    name: node.name || node.id,
    test: Boolean(node.test),
    createdAtUtc: createdAt,
    processedAtUtc: processedAt,
    cancelledAtUtc: node.cancelledAt || null,
    shopLocalDate: todayKey(access.timezone, processedAt),
    adAccountLocalDate: null as string | null,
    financialStatus: node.displayFinancialStatus || "PAID",
    currency: node.currentSubtotalPriceSet?.shopMoney?.currencyCode || access.currency,
    subtotal: moneyAmount(node.currentSubtotalPriceSet),
    totalDiscounts: moneyAmount(node.totalDiscountsSet),
    shippingCharged: moneyAmount(node.totalShippingPriceSet),
    totalTax: moneyAmount(node.totalTaxSet),
    totalPrice: moneyAmount(node.totalPriceSet),
    totalRefunded: moneyAmount(node.totalRefundedSet),
    gatewaysJson: JSON.stringify(node.paymentGatewayNames ?? []),
    sourceName: node.sourceName ?? null,
    landingSite: last?.landingPage || first?.landingPage || null,
    referringSite: last?.referrerUrl || first?.referrerUrl || null,
    firstUtmSource: first?.utmParameters?.source ?? null,
    firstUtmMedium: first?.utmParameters?.medium ?? null,
    firstUtmCampaign: first?.utmParameters?.campaign ?? null,
    firstUtmTerm: first?.utmParameters?.term ?? null,
    firstUtmContent: first?.utmParameters?.content ?? null,
    lastUtmSource: last?.utmParameters?.source ?? null,
    lastUtmMedium: last?.utmParameters?.medium ?? null,
    lastUtmCampaign: last?.utmParameters?.campaign ?? null,
    lastUtmTerm: last?.utmParameters?.term ?? null,
    lastUtmContent: last?.utmParameters?.content ?? null,
    customerIdHash: customerGid ? hashCustomerId(access.storeId, customerGid) : null,
    cogsTotal: econ.cogsTotal,
    shippingCostTotal: econ.shippingCostTotal,
    paymentFees: econ.paymentFees,
    contributionMargin: econ.contributionMargin,
    costsComplete: econ.costsComplete,
    shopifyUpdatedAt: node.updatedAt || now,
    syncedAt: now,
  };

  if (existing) {
    await db.update(shopifyOrders).set(row).where(eq(shopifyOrders.id, node.id));
    await db.delete(shopifyLineItems).where(eq(shopifyLineItems.orderId, node.id));
    await db.delete(shopifyRefunds).where(eq(shopifyRefunds.orderId, node.id));
    await db.delete(adAttributions).where(eq(adAttributions.orderId, node.id));
  } else {
    await db.insert(shopifyOrders).values(row);
  }

  if (lines.length) {
    await db.insert(shopifyLineItems).values(
      lines.map((line) => ({
        ...line,
        orderId: node.id,
      })),
    );
  }
  if (refunds.length) {
    await db.insert(shopifyRefunds).values(refunds.map((refund) => ({ ...refund, orderId: node.id })));
  }

  const entities = await db.select().from(metaEntities);
  const matches = matchAttribution(
    {
      last: {
        source: row.lastUtmSource,
        campaign: row.lastUtmCampaign,
        term: row.lastUtmTerm,
        content: row.lastUtmContent,
      },
      first: {
        source: row.firstUtmSource,
        campaign: row.firstUtmCampaign,
        term: row.firstUtmTerm,
        content: row.firstUtmContent,
      },
    },
    (id, level) => entities.some((entity) => entity.id === id && entity.level === level),
    (term) => entities.find((entity) => entity.level === "ADSET" && entity.name === term)?.id ?? null,
  );
  if (matches.length) {
    await db.insert(adAttributions).values(
      matches.map((match) => ({
        id: nid("attr"),
        orderId: node.id,
        platform: "meta",
        model: match.model,
        campaignId: match.campaignId,
        adsetId: match.adsetId,
        adId: match.adId,
        confidence: match.confidence,
        matchedAt: now,
      })),
    );
    const lastExact = matches.find(
      (match) =>
        match.model === "UTM_LAST_VISIT" &&
        (match.confidence === "EXACT_ID" || match.confidence === "ID_FROM_NAME_LOOKUP") &&
        match.adsetId,
    );
    if (lastExact?.adsetId) {
      const entity = entities.find((row) => row.id === lastExact.adsetId);
      if (entity) {
        await db
          .update(shopifyOrders)
          .set({ adAccountLocalDate: todayKey("UTC", processedAt) })
          .where(eq(shopifyOrders.id, node.id));
      }
    }
  }

  return { skipped: false as const, orderId: node.id };
}
