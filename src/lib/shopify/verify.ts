import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyShopifyHmac(rawBody: string, hmacHeader: string, secret: string): boolean {
  if (!hmacHeader || !secret) return false;
  const digest = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  const expected = Buffer.from(digest);
  const received = Buffer.from(hmacHeader);
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}

export function shopifyWebhookSecret() {
  return (
    process.env.SHOPIFY_WEBHOOK_SECRET?.trim() ||
    process.env.SHOPIFY_CLIENT_SECRET?.trim() ||
    process.env.SHOPIFY_API_SECRET?.trim() ||
    ""
  );
}
