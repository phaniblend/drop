import { NextRequest } from "next/server";
import { ensureDb } from "@/lib/db";
import { ingestShopifyWebhook } from "@/lib/shopify/webhook-ingress";
import { processWebhook } from "@/lib/shopify/webhook-worker";
import { shopifyWebhookSecret } from "@/lib/shopify/verify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const db = await ensureDb();
  const result = await ingestShopifyWebhook({
    rawBody,
    headers: req.headers,
    secret: shopifyWebhookSecret(),
    db,
  });
  if (result.status === 200 && result.body === "ok" && result.dedupeKey) {
    void processWebhook(result.dedupeKey, { db });
  }
  return new Response(result.body, { status: result.status });
}
