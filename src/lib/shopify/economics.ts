import { round2 } from "./cogs";

export type EconomicsLine = {
  quantity: number;
  refundedQuantity: number;
  unitPrice: number;
  totalDiscount: number;
  unitCogsSnapshot: number | null;
  unitShipSnapshot: number | null;
};

export type EconomicsInput = {
  cancelled: boolean;
  lines: EconomicsLine[];
  shippingCharged: number;
  totalPrice: number;
  refundedMoney: number;
  feePct: number;
  currencyConversionPct: number;
  fixedFee: number;
};

export function recomputeOrderEconomics(input: EconomicsInput) {
  if (input.cancelled) {
    return {
      netItemRevenue: 0,
      grossCollected: 0,
      cogsTotal: 0,
      shippingCostTotal: 0,
      paymentFees: round2(input.totalPrice * (input.feePct + input.currencyConversionPct) + input.fixedFee),
      contributionMargin: round2(
        0 - input.refundedMoney - (input.totalPrice * (input.feePct + input.currencyConversionPct) + input.fixedFee),
      ),
      costsComplete: true,
    };
  }

  let netItemRevenue = 0;
  let cogsTotal = 0;
  let shippingCostTotal = 0;
  let costsComplete = true;
  for (const line of input.lines) {
    const remain = Math.max(0, line.quantity - line.refundedQuantity);
    const keepRatio = line.quantity > 0 ? remain / line.quantity : 0;
    netItemRevenue += line.unitPrice * remain - line.totalDiscount * keepRatio;
    if (line.unitCogsSnapshot == null) costsComplete = false;
    else cogsTotal += line.unitCogsSnapshot * remain;
    shippingCostTotal += (line.unitShipSnapshot ?? 0) * remain;
  }
  const grossCollected = netItemRevenue + input.shippingCharged;
  const paymentFees = round2(input.totalPrice * (input.feePct + input.currencyConversionPct) + input.fixedFee);
  const contributionMargin = round2(
    grossCollected - input.refundedMoney - cogsTotal - shippingCostTotal - paymentFees,
  );
  return {
    netItemRevenue: round2(netItemRevenue),
    grossCollected: round2(grossCollected),
    cogsTotal: round2(cogsTotal),
    shippingCostTotal: round2(shippingCostTotal),
    paymentFees,
    contributionMargin,
    costsComplete,
  };
}

export function shouldSkipStale(existingUpdatedAt: string | null | undefined, incomingUpdatedAt: string) {
  if (!existingUpdatedAt) return false;
  return Date.parse(existingUpdatedAt) >= Date.parse(incomingUpdatedAt);
}
