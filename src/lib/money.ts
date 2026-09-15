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

export function suggestedRetail(cost: number, shipping: number, multiplier = 3) {
  return round2((cost + shipping) * multiplier);
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
}) {
  const { margin } = unitMargin(input.retail, input.cost, input.shipping);
  const marginPts = clamp01(margin) * 40;
  const stockPts = input.stock >= 200 ? 15 : input.stock >= 50 ? 10 : 4;
  const shipPts = input.shippingDays <= 10 ? 20 : input.shippingDays <= 16 ? 12 : 5;
  const demandPts = clamp01(input.demand) * 25;
  return Math.round(marginPts + stockPts + shipPts + demandPts);
}

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}
