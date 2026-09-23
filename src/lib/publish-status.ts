/** Pure helpers for Shopify publish outcomes (unit-tested). */

export type PublishMode = "live" | "local_only";

export function productStatusAfterPublish(mode: PublishMode): "published" | "local_only" {
  return mode === "live" ? "published" : "local_only";
}

export function shouldMarkPublished(mode: PublishMode) {
  return mode === "live";
}

export function shopifyAdminProductUrl(domain: string, productGid: string) {
  const host = domain.replace(/\.myshopify\.com$/i, "").trim();
  if (!host || !productGid) return "";
  const numeric = productGid.match(/Product\/(\d+)/)?.[1] ?? "";
  if (!numeric) return "";
  return `https://admin.shopify.com/store/${host}/products/${numeric}`;
}
