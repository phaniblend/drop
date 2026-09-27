import { suggestedRetail, winningScore } from "./money";
import type { FeedProduct } from "./supplier-feed";

export const DISCOVER_SORTS = [
  { id: "best", label: "Best to sell" },
  { id: "cost", label: "Lowest cost" },
  { id: "sell", label: "Highest sell price" },
  { id: "sold", label: "Most sold" },
  { id: "rating", label: "Top rated" },
  { id: "ship", label: "Fastest ship" },
] as const;

export type DiscoverSortId = (typeof DISCOVER_SORTS)[number]["id"];

/** AliExpress sends 4.8 stars or a 96.7% positive rate. */
export function parseSupplierRating(raw: unknown): number | undefined {
  const text = String(raw ?? "").replace(/%/g, "").trim();
  const n = Number.parseFloat(text);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  if (n > 5) return Math.min(5, Math.round((n / 100) * 5 * 10) / 10);
  return Math.min(5, Math.round(n * 10) / 10);
}

export function discoverMetrics(product: FeedProduct) {
  const variantCosts = (product.variants ?? [])
    .map((v) => v.cost)
    .filter((c) => Number.isFinite(c) && c > 0);
  const cost = variantCosts.length ? Math.min(...variantCosts) : product.cost;
  const retail = suggestedRetail(cost, product.shipping, 3);
  const score = winningScore({
    retail,
    cost,
    shipping: product.shipping,
    stock: product.stock,
    shippingDays: product.shippingDays,
    demand: product.demand,
  });
  return {
    cost,
    retail,
    score,
    orders: product.orders30d ?? product.demand * 1000,
    rating: product.rating ?? 0,
    ship: product.shippingDays > 0 ? product.shippingDays : Number.POSITIVE_INFINITY,
  };
}

export function sortDiscoverItems(items: FeedProduct[], sort: DiscoverSortId): FeedProduct[] {
  const ranked = items.map((item, index) => ({ item, index, m: discoverMetrics(item) }));
  ranked.sort((a, b) => {
    let cmp = 0;
    if (sort === "best") cmp = b.m.score - a.m.score;
    else if (sort === "cost") cmp = a.m.cost - b.m.cost;
    else if (sort === "sell") cmp = b.m.retail - a.m.retail;
    else if (sort === "sold") cmp = b.m.orders - a.m.orders;
    else if (sort === "rating") cmp = b.m.rating - a.m.rating;
    else cmp = a.m.ship - b.m.ship;
    return cmp || a.index - b.index;
  });
  return ranked.map((row) => row.item);
}
