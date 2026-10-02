import { NextRequest } from "next/server";
import { ensureDb } from "@/lib/db";
import { processCompliance } from "@/lib/shopify/webhook-worker";
import { shopifyWebhookSecret, verifyShopifyHmac } from "@/lib/shopify/verify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const secret = shopifyWebhookSecret();
  const hmac = req.headers.get("x-shopify-hmac-sha256") ?? "";
  if (!verifyShopifyHmac(rawBody, hmac, secret)) {
    return new Response("unauthorized", { status: 401 });
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  const topic = req.headers.get("x-shopify-topic") ?? "";
  const shopDomain = req.headers.get("x-shopify-shop-domain") ?? "";
  const db = await ensureDb();
  void processCompliance({ topic, shopDomain, payload }, db);
  return new Response("ok", { status: 200 });
}
