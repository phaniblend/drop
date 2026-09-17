import { NextRequest, NextResponse } from "next/server";
import { ensureDb } from "@/lib/db";
import { orders, orderItems, products, users } from "@/lib/db/schema";
import { logActivity } from "@/lib/db/seed";
import { env } from "@/lib/env";
import { netProfit, processorFee } from "@/lib/money";
import { nid, nowIso } from "@/lib/utils";

export async function POST(req: NextRequest) {
  if (env.shopifyWebhookSecret) {
    const hmac = req.headers.get("x-shopify-hmac-sha256");
    if (!hmac) {
      return NextResponse.json({ error: "Missing HMAC" }, { status: 401 });
    }
  }

  const payload = (await req.json()) as {
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

  const db = await ensureDb();
  const [operator] = await db.select({ id: users.id }).from(users).limit(1);
  if (!operator) {
    return NextResponse.json({ error: "No operator signed in yet" }, { status: 503 });
  }
  const catalog = await db.select().from(products);
  const revenue = parseFloat(payload.total_price || "0");
  const cogsGuess = catalog.length
    ? catalog.reduce((s, p) => s + p.baseCost + p.shippingCost, 0) / catalog.length
    : revenue * 0.35;
  const fee = processorFee(revenue);
  const margin = netProfit({ revenue, cogs: cogsGuess });
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
    totalCogs: cogsGuess,
    paymentFee: fee,
    netMargin: margin,
    fulfillmentStatus: "pending_batch",
    createdAt: nowIso(),
  });

  for (const item of payload.line_items ?? []) {
    await db.insert(orderItems).values({
      id: nid("itm"),
      orderId: id,
      title: item.title || "Item",
      sku: item.sku || "SKU",
      quantity: item.quantity || 1,
      unitPrice: parseFloat(item.price || "0"),
      unitCost: cogsGuess,
    });
  }

  await logActivity(db, {
    kind: "order",
    message: `Shopify webhook captured ${payload.name ?? "an order"}.`,
    href: "/orders",
  });

  return NextResponse.json({ ok: true, id });
}
