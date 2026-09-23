/** Explicit retail wins; markup is derived from first variant cost when present. */
export function applyExplicitRetailPrice(input: {
  retailPrice: number;
  markupMultiplier: number;
  firstVariantCost: number;
}) {
  const retailPrice = Number(Number(input.retailPrice).toFixed(2));
  let markupMultiplier = Number(input.markupMultiplier);
  if (input.firstVariantCost > 0 && retailPrice > 0) {
    markupMultiplier = Number((retailPrice / input.firstVariantCost).toFixed(2));
  }
  if (!Number.isFinite(markupMultiplier) || markupMultiplier <= 0) markupMultiplier = 3;
  return { retailPrice, markupMultiplier };
}

export function shouldUpdateShopifyProduct(existingId: string | null | undefined) {
  return Boolean(existingId?.trim());
}
