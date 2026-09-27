const SHOPIFY_GID = /\s*\(?gid:\/\/shopify\/Product\/[^)\s]+\)?/gi;
const PUSHED = /^(.+?)\s+pushed to Shopify\b.*$/i;
const PUBLISHED_SHOPIFY = /^Published\s+(.+?)\s+to Shopify\b.*$/i;

export function operatorHasShopifyOAuth(user?: {
  shopifyDomain?: string | null;
  shopifyAccessToken?: string | null;
} | null) {
  return Boolean(user?.shopifyDomain?.trim() && user?.shopifyAccessToken?.trim());
}

/** Hide leftover Shopify GIDs unless this desk connected Shopify on purpose. */
export function sanitizeActivityMessage(message: string, shopifyOAuth = false) {
  const raw = message.trim();
  if (shopifyOAuth) {
    return raw.replace(SHOPIFY_GID, "").replace(/\s{2,}/g, " ").trim();
  }

  const pushed = raw.match(PUSHED);
  if (pushed?.[1]) return `Published ${cleanTitle(pushed[1])} to your Seto Storefront`;

  const published = raw.match(PUBLISHED_SHOPIFY);
  if (published?.[1]) return `Published ${cleanTitle(published[1])} to your Seto Storefront`;

  if (/gid:\/\/shopify/i.test(raw)) {
    const title = raw
      .replace(SHOPIFY_GID, "")
      .replace(/\b(pushed|published)\s+to\s+Shopify\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (title) return `Published ${cleanTitle(title)} to your Seto Storefront`;
    return "Published a product to your Seto Storefront";
  }

  return raw;
}

function cleanTitle(value: string) {
  return value.replace(/^Published\s+/i, "").replace(/[.]+$/, "").trim() || "a product";
}
