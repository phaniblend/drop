/** Explicit retail wins; markup is derived from landed cost (item + ship) when present. */
export function applyExplicitRetailPrice(input: {
  retailPrice: number;
  markupMultiplier: number;
  firstVariantCost: number;
  shippingCost?: number;
}) {
  const retailPrice = Number(Number(input.retailPrice).toFixed(2));
  const ship = Number(input.shippingCost ?? 0);
  const landed =
    input.firstVariantCost > 0
      ? input.firstVariantCost + (Number.isFinite(ship) && ship > 0 ? ship : 0)
      : 0;
  let markupMultiplier = Number(input.markupMultiplier);
  if (landed > 0 && retailPrice > 0) {
    markupMultiplier = Number((retailPrice / landed).toFixed(4));
  }
  if (!Number.isFinite(markupMultiplier) || markupMultiplier <= 0) markupMultiplier = 3;
  return { retailPrice, markupMultiplier };
}

export function shouldUpdateShopifyProduct(existingId: string | null | undefined) {
  return Boolean(existingId?.trim());
}
