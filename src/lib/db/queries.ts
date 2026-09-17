import { desc, eq } from "drizzle-orm";
import { integrationStatus } from "../env";
import { netProfit, unitMargin, winningScore } from "../money";
import { round2, todayKey } from "../utils";
import { ensureDb } from "./index";
import {
  activityLog,
  campaignTrackers,
  csMacros,
  dailyTasks,
  orderItems,
  orders,
  productVariants,
  products,
  refunds,
  suppliers,
  users,
  type CampaignTracker,
  type Order,
  type Product,
} from "./schema";
import { assertProductQuota, incrementProductsImported } from "../billing";

export async function getOperator() {
  const db = await ensureDb();
  const [user] = await db.select().from(users).limit(1);
  return user ?? null;
}

export async function requireOperator() {
  const user = await getOperator();
  if (!user) throw new Error("Sign in with Google first.");
  return user;
}

export async function listProducts() {
  const db = await ensureDb();
  const rows = await db.select().from(products).orderBy(desc(products.createdAt));
  const variants = await db.select().from(productVariants);
  const byProduct = new Map<string, typeof variants>();
  for (const v of variants) {
    const list = byProduct.get(v.productId) ?? [];
    list.push(v);
    byProduct.set(v.productId, list);
  }
  return rows.map((p) => {
    const vars = byProduct.get(p.id) ?? [];
    const stock = vars.reduce((s, v) => s + v.inventoryCount, 0);
    const economics = unitMargin(p.retailPrice, p.baseCost, p.shippingCost);
    return { ...p, variants: vars, stock, economics };
  });
}

export async function getProduct(id: string) {
  const db = await ensureDb();
  const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!product) return null;
  const variants = await db.select().from(productVariants).where(eq(productVariants.productId, id));
  const campaigns = await db
    .select()
    .from(campaignTrackers)
    .where(eq(campaignTrackers.productId, id));
  return { ...product, variants, campaigns, economics: unitMargin(product.retailPrice, product.baseCost, product.shippingCost) };
}

export async function listOrders(status?: string) {
  const db = await ensureDb();
  const rows = status
    ? await db
        .select()
        .from(orders)
        .where(eq(orders.fulfillmentStatus, status))
        .orderBy(desc(orders.createdAt))
    : await db.select().from(orders).orderBy(desc(orders.createdAt));
  const items = await db.select().from(orderItems);
  const byOrder = new Map<string, typeof items>();
  for (const item of items) {
    const list = byOrder.get(item.orderId) ?? [];
    list.push(item);
    byOrder.set(item.orderId, list);
  }
  return rows.map((o) => ({ ...o, items: byOrder.get(o.id) ?? [] }));
}

export async function getOrder(id: string) {
  const db = await ensureDb();
  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) return null;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
  return { ...order, items };
}

export async function listCampaigns() {
  const db = await ensureDb();
  const rows = await db.select().from(campaignTrackers);
  const catalog = await db.select().from(products);
  const byId = new Map(catalog.map((p) => [p.id, p]));
  return rows.map((c) => {
    const product = c.productId ? byId.get(c.productId) : undefined;
    const cogsToday = product
      ? round2((product.baseCost + product.shippingCost) * c.ordersCount)
      : round2(c.revenueToday * 0.35);
    const profit = netProfit({
      revenue: c.revenueToday,
      cogs: cogsToday,
      adSpend: c.spendToday,
    });
    const roas = c.spendToday > 0 ? c.revenueToday / c.spendToday : 0;
    const paused = Boolean(c.isPaused);
    const ctr = c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0;
    const cpc = c.clicks > 0 ? c.spendToday / c.clicks : 0;
    const atRisk =
      !paused &&
      (c.spendToday >= c.spendLimitThreshold && (profit < 0 || roas < c.minRoasThreshold));
    return { ...c, isPaused: paused, product, cogsToday, profit, roas, ctr, cpc, atRisk };
  });
}

export async function listSuppliers() {
  const db = await ensureDb();
  const vendorRows = await db.select().from(suppliers);
  const catalog = await listProducts();
  return vendorRows.map((s) => {
    const skus = catalog.filter((p) => p.supplierName === s.name);
    const lowStock = skus.filter((p) => p.stock < 30);
    return { ...s, skus, lowStock };
  });
}

export async function listMacros() {
  const db = await ensureDb();
  return db.select().from(csMacros);
}

export async function listTasks() {
  const db = await ensureDb();
  return db.select().from(dailyTasks).orderBy(dailyTasks.sortOrder);
}

export async function listRefunds() {
  const db = await ensureDb();
  const rows = await db.select().from(refunds).orderBy(desc(refunds.createdAt));
  const allOrders = await db.select().from(orders);
  const byId = new Map(allOrders.map((o) => [o.id, o]));
  return rows.map((r) => ({ ...r, order: r.orderId ? byId.get(r.orderId) : undefined }));
}

export async function listActivity(limit = 12) {
  const db = await ensureDb();
  return db.select().from(activityLog).orderBy(desc(activityLog.createdAt)).limit(limit);
}

export function agingHours(order: Pick<Order, "createdAt">) {
  return (Date.now() - new Date(order.createdAt).getTime()) / 3600_000;
}

export async function getDashboard() {
  const [user, catalog, orderRows, campaignRows, tasks, activity, refundRows, integrations] =
    await Promise.all([
      getOperator(),
      listProducts(),
      listOrders(),
      listCampaigns(),
      listTasks(),
      listActivity(),
      listRefunds(),
      Promise.resolve(integrationStatus()),
    ]);

  const today = todayKey(user?.timezone);
  const isToday = (iso: string) => iso.slice(0, 10) === today || todayKey() === iso.slice(0, 10);

  const todaysOrders = orderRows.filter((o) => isToday(o.createdAt) || agingHours(o) < 24);
  const revenue = round2(todaysOrders.reduce((s, o) => s + o.totalRevenue, 0));
  const cogs = round2(todaysOrders.reduce((s, o) => s + o.totalCogs, 0));
  const fees = round2(todaysOrders.reduce((s, o) => s + o.paymentFee, 0));
  const adSpend = round2(campaignRows.reduce((s, c) => s + c.spendToday, 0));
  const profit = round2(revenue - cogs - fees - adSpend);

  const pending = orderRows.filter((o) => o.fulfillmentStatus === "pending_batch");
  const needTracking = orderRows.filter(
    (o) => o.fulfillmentStatus === "ordered_supplier" && !o.trackingNumber,
  );
  const shippedAging = orderRows.filter((o) => {
    if (o.fulfillmentStatus !== "shipped") return false;
    return agingHours(o) > 24 * 12;
  });
  const lowStock = catalog.filter((p) => p.stock < 30 && p.status === "published");
  const atRiskAds = campaignRows.filter((c) => c.atRisk);

  const last7 = Array.from({ length: 7 }).map((_, i) => {
    const day = new Date();
    day.setDate(day.getDate() - (6 - i));
    const key = day.toISOString().slice(0, 10);
    const dayOrders = orderRows.filter((o) => o.createdAt.slice(0, 10) === key);
    const dayRevenue = dayOrders.reduce((s, o) => s + o.totalRevenue, 0);
    const dayCogs = dayOrders.reduce((s, o) => s + o.totalCogs, 0);
    const dayFees = dayOrders.reduce((s, o) => s + o.paymentFee, 0);
    const daySpend = i === 6 ? adSpend : 0;
    return {
      key,
      label: day.toLocaleDateString("en-US", { weekday: "short" }),
      revenue: round2(dayRevenue),
      profit: round2(dayRevenue - dayCogs - dayFees - daySpend),
      orders: dayOrders.length,
    };
  });

  const topProducts = catalog
    .map((p) => {
      const sold = orderRows
        .flatMap((o) => o.items)
        .filter((item) => item.productId === p.id)
        .reduce((s, item) => s + item.quantity, 0);
      return { ...p, sold, profit: round2(p.economics.profit * sold) };
    })
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 5);

  return {
    user,
    integrations,
    kpis: {
      revenue,
      cogs,
      fees,
      adSpend,
      profit,
      orders: todaysOrders.length,
      avgMargin: revenue > 0 ? profit / revenue : 0,
    },
    alerts: [
      ...atRiskAds.map((c) => ({
        tone: "loss" as const,
        title: `${c.adSetName} is burning margin`,
        detail: `Spend ${c.spendToday.toFixed(2)} / sales ${c.revenueToday.toFixed(2)} · ${c.roas.toFixed(2)}x back from ads`,
        href: "/ads",
      })),
      ...pending
        .filter((o) => agingHours(o) > 6)
        .slice(0, 3)
        .map((o) => ({
          tone: "warn" as const,
          title: `${o.orderNumber} still waiting to ship`,
          detail: `${o.customerName} · ${Math.round(agingHours(o))}h waiting`,
          href: "/fulfillment",
        })),
      ...lowStock.map((p) => ({
        tone: "warn" as const,
        title: `${p.cleanTitle ?? p.rawTitle} low at supplier`,
        detail: `${p.stock} units left — pause ads if it hits 10`,
        href: "/suppliers",
      })),
      ...shippedAging.map((o) => ({
        tone: "warn" as const,
        title: `${o.orderNumber} tracking is stale`,
        detail: `${o.trackingNumber ?? "No scan"} · ${o.customerName}`,
        href: "/ops",
      })),
      ...refundRows
        .filter((r) => r.status === "open")
        .map((r) => ({
          tone: "loss" as const,
          title: `Refund open${r.order ? ` on ${r.order.orderNumber}` : ""}`,
          detail: r.reason,
          href: "/ops",
        })),
      ...catalog
        .filter((p) => p.organicStatus === "pending")
        .slice(0, 4)
        .map((p) => ({
          tone: "warn" as const,
          title: `Organic test still open: ${p.cleanTitle ?? p.rawTitle}`,
          detail: "3 hook videos need 1,000+ views each before paid launch.",
          href: "/ops",
        })),
    ],
    pendingCount: pending.length,
    needTrackingCount: needTracking.length,
    last7,
    topProducts,
    recentOrders: orderRows.slice(0, 6),
    tasks,
    activity,
    campaignRows,
    catalog,
    organicQueue: catalog.filter((p) => p.organicStatus === "pending"),
  };
}

export function productScore(p: Product & { stock?: number }) {
  return winningScore({
    retail: p.retailPrice,
    cost: p.baseCost,
    shipping: p.shippingCost,
    stock: p.stock ?? 100,
    shippingDays: p.shippingDays,
    demand: p.status === "published" ? 0.8 : 0.55,
  });
}

export async function insertImportedProduct(input: {
  rawTitle: string;
  cleanTitle: string;
  descriptionHtml: string;
  supplierUrl: string;
  supplierName?: string;
  supplierSource?: string;
  imageUrl?: string;
  gallery?: string[];
  baseCost: number;
  shippingCost: number;
  retailPrice: number;
  shippingDays?: number;
  niche?: string;
  tags?: string;
  variants: Array<{
    skuId: string;
    name: string;
    cost: number;
    price: number;
    stock: number;
    imageUrl?: string;
  }>;
}) {
  await assertProductQuota();
  const operator = await requireOperator();
  const db = await ensureDb();
  const id = `prod_${crypto.randomUUID().slice(0, 10)}`;
  await db.insert(products).values({
    id,
    userId: operator.id,
    supplierSource: input.supplierSource ?? "aliexpress",
    supplierUrl: input.supplierUrl,
    supplierName: input.supplierName ?? "AliExpress",
    rawTitle: input.rawTitle,
    cleanTitle: input.cleanTitle,
    descriptionHtml: input.descriptionHtml,
    tags: input.tags ?? "",
    imageUrl: input.imageUrl ?? null,
    galleryJson: JSON.stringify(input.gallery ?? []),
    baseCost: input.baseCost,
    shippingCost: input.shippingCost,
    retailPrice: input.retailPrice,
    shippingDays: input.shippingDays ?? 14,
    status: "draft",
    niche: input.niche ?? "general",
    organicStatus: "pending",
    organicViewsJson: "[0,0,0]",
    createdAt: new Date().toISOString(),
  });
  if (input.variants.length) {
    await db.insert(productVariants).values(
      input.variants.map((v, i) => ({
        id: `${id}_var_${i + 1}`,
        productId: id,
        supplierSkuId: v.skuId,
        variantName: v.name,
        variantCost: v.cost,
        variantPrice: v.price,
        inventoryCount: v.stock,
        supplierImageUrl: v.imageUrl ?? input.imageUrl ?? null,
        cleanImageUrl: v.imageUrl ?? input.imageUrl ?? null,
      })),
    );
  }
  await incrementProductsImported();
  return id;
}

export { desc, eq };
export type { CampaignTracker };
