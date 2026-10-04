/** Shared Discover card pricing — same accessory filter as preview/import. */

import { discoverShipping, plausibleDiscoverCost } from "./discover-cost";
import type { FeedProduct } from "./supplier-feed";
import { partitionVariants } from "./variant-pricing";

export function discoverPrimaryVariants(product: FeedProduct) {
  const raw = (product.variants ?? []).filter((v) => Number.isFinite(v.cost) && v.cost > 0);
  const rows = raw.length
    ? raw.map((v) => ({ cost: v.cost, name: v.attributes, attributes: v.attributes, stock: v.stock }))
    : product.cost > 0
      ? [{ cost: product.cost, name: "Default", attributes: "Default", stock: product.stock }]
      : [];
  const { primary, accessories } = partitionVariants(rows);
  return { primary: primary.length ? primary : rows, accessories };
}

/** Cost used on Discover cards and sort scores. Unverified feed prices do not drive sell/score. */
export function discoverCardCost(product: FeedProduct) {
  const { primary, accessories } = discoverPrimaryVariants(product);
  const costs = primary.map((v) => v.cost).filter((c) => c > 0);
  const rawMin = costs.length ? Math.min(...costs) : product.cost;
  const cost = plausibleDiscoverCost(rawMin);
  const verified = product.stockKnown === true && cost > 0;
  const shipping = discoverShipping(product.shipping);
  return {
    cost: verified ? cost : 0,
    estimate: cost,
    verified,
    shipping,
    accessoriesExcluded: accessories.length,
    stock: primary.reduce((s, v) => s + Math.max(0, v.stock || 0), 0),
  };
}
