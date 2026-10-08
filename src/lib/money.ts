import { round2 } from "./utils";

export const DEFAULT_FEE_RATE = 0.029;
export const DEFAULT_FEE_FIXED = 0.3;

export function processorFee(
  revenue: number,
  rate = DEFAULT_FEE_RATE,
  fixed = DEFAULT_FEE_FIXED,
) {
  if (revenue <= 0) return 0;
  return round2(revenue * rate + fixed);
}

/** Spec formula: Revenue - COGS - Ad Spend - (Revenue × 0.029 + $0.30) */
export function netProfit(input: {
  revenue: number;
  cogs: number;
  adSpend?: number;
  feeRate?: number;
  feeFixed?: number;
}) {
  const spend = input.adSpend ?? 0;
  const fees = processorFee(input.revenue, input.feeRate, input.feeFixed);
  return round2(input.revenue - input.cogs - spend - fees);
}

/** Round to a shopper-friendly .99 (or .49 when under $10). */
export function retailEnding(raw: number) {
  if (!(raw > 0)) return 0;
  if (raw < 10) return round2(Math.ceil(raw * 2) / 2 - 0.01);
  return round2(Math.ceil(raw) - 0.01);
}

export function suggestedRetail(cost: number, shipping: number, multiplier = 3) {
  return retailEnding((cost + shipping) * multiplier);
}

/** True when a saved retail looks hand-tuned vs (cost+ship)×markup (within ~8%). */
export function pricesMatchMarkup(
  retail: number,
  cost: number,
  shipping: number,
  markup: number,
  tol = 0.08,
) {
  if (!(retail > 0) || !(cost > 0) || !(markup > 0)) return false;
  const ship = shipping > 0 ? shipping : 0;
  const expected = retailEnding((cost + ship) * markup);
  if (!(expected > 0)) return false;
  return Math.abs(retail - expected) / expected <= tol || Math.abs(retail - (cost + ship) * markup) / retail <= tol;
}

export function unitMargin(retail: number, cost: number, shipping: number) {
  const cogs = cost + shipping;
  const fee = processorFee(retail);
  const profit = round2(retail - cogs - fee);
  const margin = retail > 0 ? profit / retail : 0;
  return { cogs, fee, profit, margin };
}

export function breakevenRoas(retail: number, cost: number, shipping: number) {
  const { profit } = unitMargin(retail, cost, shipping);
  const contribution = retail - (cost + shipping) - processorFee(retail);
  if (contribution <= 0) return Infinity;
  return round2(retail / contribution);
}

export function winningScore(input: {
  retail: number;
  cost: number;
  shipping: number;
  stock: number;
  shippingDays: number;
  demand: number;
  rating?: number;
  orders30d?: number;
}) {
  if (!(input.cost > 0) || !(input.retail > 0)) return 0;
  const { margin } = unitMargin(input.retail, input.cost, input.shipping);
  const marginPts = clamp01(margin) * 32;
  const stockPts = input.stock >= 200 ? 12 : input.stock >= 50 ? 8 : input.stock > 0 ? 5 : 1;
  const shipPts =
    input.shippingDays <= 0 ? 5 : input.shippingDays <= 10 ? 16 : input.shippingDays <= 16 ? 10 : 4;
  const demandPts = input.demand > 0 ? clamp01(input.demand) * 18 : 3;
  const orders = input.orders30d ?? 0;
  const orderPts = orders >= 5000 ? 12 : orders >= 1000 ? 9 : orders >= 200 ? 6 : orders > 0 ? 3 : 0;
  const rating = input.rating ?? 0;
  const ratingPts = rating >= 4.7 ? 10 : rating >= 4.3 ? 7 : rating >= 4 ? 4 : rating > 0 ? 2 : 0;
  return Math.round(marginPts + stockPts + shipPts + demandPts + orderPts + ratingPts);
}

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}
