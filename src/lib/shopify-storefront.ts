import "server-only";

import { env } from "./env";

/** Public myshopify host for the connected merchant store, or empty if not configured. */
export function shopifyStorefrontHost() {
  const domain = env.shopifyDomain.trim();
  if (!domain) return "";
  return domain.includes(".") ? domain : `${domain}.myshopify.com`;
}

export function shopifyStorefrontHomeUrl() {
  const host = shopifyStorefrontHost();
  return host ? `https://${host}` : "";
}

export function shopifyProductUrl(handle: string) {
  const home = shopifyStorefrontHomeUrl();
  if (!home || !handle) return "";
  const slug = handle.replace(/^\/+|\/+$/g, "");
  return `${home}/products/${slug}`;
}
