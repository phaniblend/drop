/** Typical single-item AliExpress cost in USD. Higher values are usually CNY or a pack. */
export const DISCOVER_COST_CEILING = 45;
export const ESTIMATED_SHIP_USD = 2.49;

export function plausibleDiscoverCost(cost: number) {
  if (!Number.isFinite(cost) || cost < 0.2) return 0;
  if (cost > DISCOVER_COST_CEILING) return 0;
  return Number(cost.toFixed(2));
}

export function discoverShipping(shipping: number) {
  if (Number.isFinite(shipping) && shipping > 0) return Number(shipping.toFixed(2));
  return ESTIMATED_SHIP_USD;
}

export function discoverShippingKnown(shipping: number) {
  return Number.isFinite(shipping) && shipping > 0;
}
