import { NextRequest, NextResponse } from "next/server";
import { ensureDb } from "@/lib/db";
import { orders, orderItems, products, productVariants, users } from "@/lib/db/schema";
import { logActivity } from "@/lib/db/seed";
import { verifyShopifyWebhookHmac } from "@/lib/publisher";
import { netProfit, processorFee } from "@/lib/money";
import { nid, nowIso } from "@/lib/utils";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const hmac = req.headers.get("x-shopify-hmac-sha256");
  const verified = verifyShopifyWebhookHmac(rawBody, hmac);
  if (!verified.ok) {
    return NextResponse.json({ error: "Invalid HMAC" }, { status: 401 });
  }

  let payload: {
    id?: number | string;
    name?: string;
    email?: string;
    total_price?: string;
    shipping_address?: {
      name?: string;
      address1?: string;
      city?: string;
      province?: string;
      zip?: string;
      country?: string;
    };
    line_items?: Array<{
      title?: string;
      sku?: string;
      quantity?: number;
      price?: string;
    }>;
  };
  try {
    payload = JSON.parse(rawBody) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const db = await ensureDb();
  const [operator] = await db.select({ id: users.id }).from(users).limit(1);
  if (!operator) {
    return NextResponse.json({ error: "No operator signed in yet" }, { status: 503 });
  }

  const catalog = await db.select().from(products);
  const variants = await db.select().from(productVariants);
  const costBySku = new Map(variants.map((v) => [v.supplierSkuId.toLowerCase(), v.variantCost]));
  const costByProduct = new Map(catalog.map((p) => [p.id, p.baseCost + p.shippingCost]));

  const lineItems = payload.line_items ?? [];
  let totalCogs = 0;
  for (const item of lineItems) {
    const qty = item.quantity || 1;
    const sku = (item.sku || "").toLowerCase();
    const matched =
      (sku && costBySku.get(sku)) ||
      catalog.find((p) => p.cleanTitle === item.title || p.rawTitle === item.title);
    const unit =
      typeof matched === "number"
        ? matched
        : matched
          ? costByProduct.get(matched.id) ?? matched.baseCost + matched.shippingCost
          : catalog.length
            ? catalog.reduce((s, p) => s + p.baseCost + p.shippingCost, 0) / catalog.length
            : parseFloat(item.price || "0") * 0.35;
    totalCogs += unit * qty;
  }
  if (!lineItems.length) {
    totalCogs = catalog.length
      ? catalog.reduce((s, p) => s + p.baseCost + p.shippingCost, 0) / catalog.length
      : parseFloat(payload.total_price || "0") * 0.35;
  }

  const revenue = parseFloat(payload.total_price || "0");
  const fee = processorFee(revenue);
  const margin = netProfit({ revenue, cogs: totalCogs });
  const address = payload.shipping_address
    ? [
        payload.shipping_address.address1,
        payload.shipping_address.city,
        payload.shipping_address.province,
        payload.shipping_address.zip,
        payload.shipping_address.country,
      ]
        .filter(Boolean)
        .join(", ")
    : "Address pending";

  const id = nid("ord");
  await db.insert(orders).values({
    id,
    userId: operator.id,
    shopifyOrderId: String(payload.id ?? `hook-${Date.now()}`),
    orderNumber: String(payload.name ?? `#${Date.now().toString().slice(-5)}`),
    customerName: payload.shipping_address?.name || payload.email || "Customer",
    customerEmail: payload.email || "unknown@shop",
    shippingAddress: address,
    totalRevenue: revenue,
    totalCogs,
    paymentFee: fee,
    netMargin: margin,
    fulfillmentStatus: "pending_batch",
    createdAt: nowIso(),
  });

  for (const item of lineItems) {
    const qty = item.quantity || 1;
    const sku = (item.sku || "").toLowerCase();
    const unitCost = (sku && costBySku.get(sku)) || totalCogs / Math.max(1, lineItems.length);
    await db.insert(orderItems).values({
      id: nid("itm"),
      orderId: id,
      title: item.title || "Item",
      sku: item.sku || "item",
      quantity: qty,
      unitPrice: parseFloat(item.price || "0"),
      unitCost,
    });
  }

  await logActivity(db, {
    kind: "order",
    message: `Shopify webhook captured ${payload.name ?? "an order"}.`,
    href: "/orders",
  });

  return NextResponse.json({ ok: true, id });
}
