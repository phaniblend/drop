import "server-only";

import { env } from "./env";
import { resolveShopifyConnection } from "./shopify-oauth";

/** Public myshopify host for the connected merchant store, or empty if not configured. */
export async function shopifyStorefrontHost() {
  const conn = await resolveShopifyConnection();
  const domain = (conn?.domain || env.shopifyDomain).trim();
  if (!domain) return "";
  return domain.includes(".") ? domain : `${domain}.myshopify.com`;
}

export async function shopifyStorefrontHomeUrl() {
  const host = await shopifyStorefrontHost();
  return host ? `https://${host}` : "";
}

export async function shopifyProductUrl(handle: string) {
  const home = await shopifyStorefrontHomeUrl();
  if (!home || !handle) return "";
  const slug = handle.replace(/^\/+|\/+$/g, "");
  return `${home}/products/${slug}`;
}
