import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { env } from "./env";
import { ensureDb } from "./db";
import { users } from "./db/schema";
import { getOperator } from "./db/queries";

/** Scopes for publish + order ingest. */
export const SHOPIFY_OAUTH_SCOPES =
  process.env.SHOPIFY_SCOPES?.trim() ||
  "read_products,write_products,read_orders,write_orders,read_inventory";

export function normalizeShopDomain(input: string) {
  let shop = input.trim().toLowerCase();
  shop = shop.replace(/^https?:\/\//, "").replace(/\/$/, "");
  shop = shop.replace(/\.myshopify\.com$/i, "");
  shop = shop.split("/")[0] ?? shop;
  if (!/^[a-z0-9][a-z0-9-]*$/.test(shop)) {
    throw new Error("Enter your shop name only (e.g. my-store), not a full URL.");
  }
  return shop;
}

export function shopifyAppCredentialsReady() {
  return Boolean(env.shopifyClientId && env.shopifyClientSecret);
}

export function shopifyOAuthRedirectUri() {
  const base = (env.appUrl || "http://localhost:3000").replace(/\/$/, "");
  return `${base}/api/shopify/callback`;
}

export function createShopifyOAuthState() {
  return randomBytes(24).toString("hex");
}

export function buildShopifyAuthorizeUrl(shop: string, state: string) {
  const domain = normalizeShopDomain(shop);
  const params = new URLSearchParams({
    client_id: env.shopifyClientId,
    scope: SHOPIFY_OAUTH_SCOPES,
    redirect_uri: shopifyOAuthRedirectUri(),
    state,
  });
  return `https://${domain}.myshopify.com/admin/oauth/authorize?${params}`;
}

export function verifyShopifyOAuthHmac(query: URLSearchParams) {
  const hmac = query.get("hmac");
  if (!hmac || !env.shopifyClientSecret) return false;
  const entries: string[] = [];
  query.forEach((value, key) => {
    if (key === "hmac") return;
    entries.push(`${key}=${value}`);
  });
  entries.sort();
  const message = entries.join("&");
  const digest = createHmac("sha256", env.shopifyClientSecret).update(message).digest("hex");
  try {
    const a = Buffer.from(digest, "utf8");
    const b = Buffer.from(hmac, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function exchangeShopifyOAuthCode(shop: string, code: string) {
  const domain = normalizeShopDomain(shop);
  const res = await fetch(`https://${domain}.myshopify.com/admin/oauth/access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      client_id: env.shopifyClientId,
      client_secret: env.shopifyClientSecret,
      code,
    }),
  });
  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`Shopify token exchange failed (${res.status}): ${raw.slice(0, 240)}`);
  }
  const json = JSON.parse(raw) as { access_token?: string; scope?: string };
  if (!json.access_token) throw new Error("Shopify returned no access_token.");
  return { domain, accessToken: json.access_token, scope: json.scope ?? "" };
}

export async function saveShopifyOAuthConnection(input: { domain: string; accessToken: string }) {
  const operator = await getOperator();
  if (!operator) throw new Error("Sign in with Google first.");
  const db = await ensureDb();
  await db
    .update(users)
    .set({
      shopifyDomain: input.domain,
      shopifyAccessToken: input.accessToken,
    })
    .where(eq(users.id, operator.id));
}

export async function clearShopifyOAuthConnection() {
  const operator = await getOperator();
  if (!operator) throw new Error("Sign in with Google first.");
  const db = await ensureDb();
  await db
    .update(users)
    .set({ shopifyDomain: null, shopifyAccessToken: null })
    .where(eq(users.id, operator.id));
}

export type ShopifyConnection = {
  domain: string;
  token: string;
  source: "oauth" | "env_token" | "env_client";
};

/** Prefer Connect Shopify (operator DB), then env admin token, then client_credentials. */
export async function resolveShopifyConnection(): Promise<ShopifyConnection | null> {
  const operator = await getOperator();
  const oauthDomain = operator?.shopifyDomain?.trim();
  const oauthToken = operator?.shopifyAccessToken?.trim();
  if (oauthDomain && oauthToken) {
    return {
      domain: normalizeShopDomain(oauthDomain),
      token: oauthToken,
      source: "oauth",
    };
  }

  if (env.shopifyDomain && env.shopifyToken) {
    return { domain: env.shopifyDomain, token: env.shopifyToken, source: "env_token" };
  }

  if (env.shopifyDomain && env.shopifyClientId && env.shopifyClientSecret) {
    const token = await fetchClientCredentialsToken(env.shopifyDomain);
    if (token) {
      return { domain: env.shopifyDomain, token, source: "env_client" };
    }
  }

  return null;
}

let cachedClientToken = "";
let cachedClientExpiresAt = 0;

async function fetchClientCredentialsToken(domain: string) {
  if (cachedClientToken && Date.now() < cachedClientExpiresAt - 60_000) return cachedClientToken;
  const response = await fetch(`https://${domain}.myshopify.com/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: env.shopifyClientId,
      client_secret: env.shopifyClientSecret,
    }),
  });
  if (!response.ok) return "";
  const payload = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!payload.access_token) return "";
  cachedClientToken = payload.access_token;
  cachedClientExpiresAt = Date.now() + (payload.expires_in ?? 86399) * 1000;
  return cachedClientToken;
}

export async function shopifyIsConnected() {
  const conn = await resolveShopifyConnection();
  return Boolean(conn);
}
