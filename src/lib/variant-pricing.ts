import { round2 } from "./utils";
import { suggestedRetail } from "./money";

/** SKUs whose cost is far below the median are usually brushes/cables/gifts, not sellable options. */
export function isAccessoryOutlier(cost: number, costs: number[]) {
  const positive = costs.filter((c) => Number.isFinite(c) && c > 0).sort((a, b) => a - b);
  if (positive.length < 2 || !(cost > 0)) return false;
  const mid = positive[Math.floor(positive.length / 2)]!;
  return cost < mid * 0.35 && cost < mid - 3;
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
  return { primary, accessories };
}

/** Scale each variant's sell price with its cost so accessories don't inherit the hero price. */
export function scaleVariantPrices(
  variants: Array<{ cost: number }>,
  retailPrice: number,
  shippingCost: number,
  markup: number,
) {
  const costs = variants.map((v) => v.cost).filter((c) => c > 0);
  const base = costs.length ? Math.min(...costs.filter((c) => !isAccessoryOutlier(c, costs))) : 0;
  const anchor = base > 0 ? base : costs[0] ?? 0;
  return variants.map((v) => {
    if (!(v.cost > 0)) return round2(retailPrice);
    if (anchor > 0 && Math.abs(v.cost - anchor) < 0.02) return round2(retailPrice);
    if (isAccessoryOutlier(v.cost, costs)) {
      return suggestedRetail(v.cost, shippingCost, Math.min(markup, 2.5));
    }
    const ratio = anchor > 0 ? v.cost / anchor : 1;
    return round2(Math.max(0.5, retailPrice * ratio));
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
