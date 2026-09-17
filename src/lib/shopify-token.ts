import "server-only";

import { env } from "./env";

let cachedToken = "";
let tokenExpiresAt = 0;

export function shopifyCredentialsReady() {
  return Boolean(
    env.shopifyDomain &&
      (env.shopifyToken || (env.shopifyClientId && env.shopifyClientSecret)),
  );
}

export async function getShopifyAdminToken() {
  if (env.shopifyToken) return env.shopifyToken;
  if (!env.shopifyDomain || !env.shopifyClientId || !env.shopifyClientSecret) {
    return "";
  }
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) return cachedToken;

  const response = await fetch(`https://${env.shopifyDomain}.myshopify.com/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: env.shopifyClientId,
      client_secret: env.shopifyClientSecret,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Shopify token request failed (${response.status}): ${detail.slice(0, 240)}`);
  }

  const payload = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!payload.access_token) throw new Error("Shopify token response had no access_token.");
  cachedToken = payload.access_token;
  tokenExpiresAt = Date.now() + (payload.expires_in ?? 86399) * 1000;
  return cachedToken;
}
