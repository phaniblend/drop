import { eq } from "drizzle-orm";
import { webhookEvents } from "../db/schema-guard";
import { nid, nowIso } from "../utils";
import { extractResourceGid, sha256Hex } from "./gid";
import { verifyShopifyHmac } from "./verify";

type Db = Awaited<ReturnType<typeof import("@/lib/db").ensureDb>>;

export type IngressResult = { status: number; body: string; dedupeKey?: string; inserted?: boolean };

export async function ingestShopifyWebhook(input: {
  rawBody: string;
  headers: Headers | Record<string, string | null | undefined>;
  secret: string;
  db: Db;
}): Promise<IngressResult> {
  const header = (name: string) => {
    if (input.headers instanceof Headers) return input.headers.get(name);
    return input.headers[name] ?? input.headers[name.toLowerCase()] ?? null;
  };
  const hmac = header("x-shopify-hmac-sha256") ?? "";
  if (!verifyShopifyHmac(input.rawBody, hmac, input.secret)) {
    return { status: 401, body: "unauthorized" };
  }

  const topic = header("x-shopify-topic") ?? "";
  const shop = header("x-shopify-shop-domain") ?? "";
  const dedupeKey = header("x-shopify-event-id") ?? header("x-shopify-webhook-id") ?? "";
  if (!topic || !shop || !dedupeKey) {
    return { status: 400, body: "missing headers" };
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(input.rawBody) as Record<string, unknown>;
  } catch {
    return { status: 400, body: "invalid json" };
  }

  const [existing] = await input.db
    .select({ id: webhookEvents.id })
    .from(webhookEvents)
    .where(eq(webhookEvents.dedupeKey, dedupeKey))
    .limit(1);
  if (existing) return { status: 200, body: "duplicate", dedupeKey, inserted: false };

  await input.db.insert(webhookEvents).values({
    id: nid("wh"),
    dedupeKey,
    topic,
    shopDomain: shop,
    apiVersion: header("x-shopify-api-version"),
    triggeredAt: header("x-shopify-triggered-at"),
    receivedAtUtc: nowIso(),
    payloadHash: sha256Hex(input.rawBody),
    resourceGid: extractResourceGid(topic, payload),
    status: "QUEUED",
    attempts: 0,
  });
  return { status: 200, body: "ok", dedupeKey, inserted: true };
}
