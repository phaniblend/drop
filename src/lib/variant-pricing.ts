import { round2 } from "./utils";
import { suggestedRetail } from "./money";

/**
 * SKUs whose cost is far below the median are usually brushes/cables/gifts.
 * Pack ladders (1pcs $4 vs 4-pack $16) must stay as primary options.
 */
export function isAccessoryOutlier(cost: number, costs: number[]) {
  const positive = costs.filter((c) => Number.isFinite(c) && c > 0).sort((a, b) => a - b);
  if (positive.length < 2 || !(cost > 0)) return false;
  const mid = positive[Math.floor(positive.length / 2)]!;
  return cost < mid * 0.25 && cost < Math.min(mid - 5, 6);
}

/** Prefer main product SKUs; keep accessories tagged so UI can disable them. */
export function partitionVariants<T extends { cost: number; name?: string; attributes?: string }>(
  variants: T[],
) {
  const costs = variants.map((v) => v.cost);
  const primary: T[] = [];
  const accessories: T[] = [];
  for (const v of variants) {
    const label = `${v.name ?? ""} ${v.attributes ?? ""}`;
    const nameLooksAccessory = /\b(brush|gift|cable|adapter|spare|extra|1pc|tool kit)\b/i.test(label);
    if (isAccessoryOutlier(v.cost, costs) || nameLooksAccessory) accessories.push(v);
    else primary.push(v);
  }
  if (primary.length === 0) return { primary: variants, accessories: [] as T[] };
  // Cheapest primary first — Discover, panel, and Save pricing all share this anchor.
  primary.sort((a, b) => a.cost - b.cost);
  return { primary, accessories };
}

/** Cheapest non-accessory cost — the variant that owns the entered selling price. */
export function pricingAnchorCost(variants: Array<{ cost: number }>) {
  const costs = variants.map((v) => v.cost).filter((c) => Number.isFinite(c) && c > 0);
  if (!costs.length) return 0;
  const main = costs.filter((c) => !isAccessoryOutlier(c, costs));
  return Math.min(...(main.length ? main : costs));
}

/**
 * Apply one markup to every SKU: price = (cost + ship) × markup.
 * The entered retail is the price of the cheapest primary (anchor) SKU.
 */
export function scaleVariantPrices(
  variants: Array<{ cost: number }>,
  retailPrice: number,
  shippingCost: number,
  markup: number,
) {
  const ship = Number.isFinite(shippingCost) && shippingCost > 0 ? shippingCost : 0;
  const costs = variants.map((v) => v.cost).filter((c) => c > 0);
  const anchor = pricingAnchorCost(variants);
  const landedAnchor = anchor > 0 ? anchor + ship : 0;
  const effectiveMarkup =
    landedAnchor > 0 && retailPrice > 0
      ? retailPrice / landedAnchor
      : Number.isFinite(markup) && markup > 0
        ? markup
        : 3;

  return variants.map((v) => {
    if (!(v.cost > 0)) return round2(retailPrice);
    if (isAccessoryOutlier(v.cost, costs)) {
      return suggestedRetail(v.cost, ship, Math.min(effectiveMarkup, 2.5));
    }
    if (anchor > 0 && Math.abs(v.cost - anchor) < 0.02) return round2(retailPrice);
    return round2(Math.max(0.5, (v.cost + ship) * effectiveMarkup));
  });
}

/** Ensure each variant display name is unique within the product. */
export function uniquifyVariantNames(names: string[]) {
  const seen = new Map<string, number>();
  return names.map((raw, i) => {
    const base = (raw || `Variant ${i + 1}`).trim() || `Variant ${i + 1}`;
    const count = (seen.get(base.toLowerCase()) ?? 0) + 1;
    seen.set(base.toLowerCase(), count);
    if (count === 1) return base;
    return `${base} (${count})`;
  });
}
