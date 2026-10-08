const SHOPIFY_GID = /\s*\(?gid:\/\/shopify\/Product\/[^)\s]+\)?/gi;
const PUSHED = /^(.+?)\s+pushed to Shopify\b.*$/i;
const PUBLISHED_SHOPIFY = /^Published\s+(.+?)\s+to Shopify\b.*$/i;
const LIVE_ON_SETO = /^(.+?) is live on your Seto store\.?$/i;
const OPENED_SHOP = /^(.+?) opened your shop and is live\.?$/i;

/** Single publish phrase for activity log writes (Seto storefront, not Shopify). */
export function publishActivityMessage(title: string) {
  const name = title.trim() || "a product";
  return `Published ${name} to your Seto Storefront`;
}

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

  const liveOnSeto = raw.match(LIVE_ON_SETO);
  if (liveOnSeto?.[1]) return publishActivityMessage(cleanTitle(liveOnSeto[1]));

  const openedShop = raw.match(OPENED_SHOP);
  if (openedShop?.[1]) return publishActivityMessage(cleanTitle(openedShop[1]));

  const pushed = raw.match(PUSHED);
  if (pushed?.[1]) return publishActivityMessage(cleanTitle(pushed[1]));

  const published = raw.match(PUBLISHED_SHOPIFY);
  if (published?.[1]) return publishActivityMessage(cleanTitle(published[1]));

  if (/gid:\/\/shopify/i.test(raw)) {
    const title = raw
      .replace(SHOPIFY_GID, "")
      .replace(/\b(pushed|published)\s+to\s+Shopify\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (title) return publishActivityMessage(cleanTitle(title));
    return publishActivityMessage("");
  }

  return raw;
}

function cleanTitle(value: string) {
  return value.replace(/^Published\s+/i, "").replace(/[.]+$/, "").trim() || "a product";
}
