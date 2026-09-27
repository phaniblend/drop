import { extractAliExpressProductId } from "./aliexpress-url";
import type { FeedProduct } from "./supplier-feed";

export function savedListingKey(item: Pick<FeedProduct, "id" | "url">) {
  return extractAliExpressProductId(item.url) || item.url.split("?")[0] || item.id;
}

export function asFeedProduct(value: unknown): FeedProduct | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<FeedProduct>;
  if (!row.id || !row.url || !row.title) return null;
  return {
    id: String(row.id),
    title: String(row.title),
    cleanTitle: String(row.cleanTitle || row.title),
    url: String(row.url),
    source: row.source === "cj" ? "cj" : "aliexpress",
    supplierName: String(row.supplierName || "AliExpress"),
    niche: String(row.niche || "general"),
    cost: Number(row.cost) || 0,
    shipping: Number(row.shipping) || 0,
    shippingDays: Number(row.shippingDays) || 0,
    stock: Number(row.stock) || 0,
    stockKnown: row.stockKnown,
    demand: Number(row.demand) || 0,
    orders30d: row.orders30d,
    rating: row.rating,
    live: true,
    image: String(row.image || ""),
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    variants: Array.isArray(row.variants) ? row.variants : [],
  };
}
