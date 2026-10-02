/** Dual-signal Margin Guard formula mg-2.0.0 (§3 of the tech spec). */

export const FORMULA_VERSION = "mg-2.0.0";

export type GuardVerdict =
  | "HOLD_LEARNING"
  | "HOLD_DISAGREE"
  | "HOLD_LAG"
  | "HEALTHY"
  | "CANDIDATE_NO_SALE"
  | "CANDIDATE_NEGATIVE_NET"
  | "BLOCKED_DATA";

export type GuardEvalInput = {
  spend: number;
  nMeta: number;
  rMeta: number;
  nShop: number;
  cmShop: number;
  beCpa: number | null;
  marginRatio: number;
  breakEvenMultiplier?: number;
  minSpendFloor?: number;
  lossTolerancePct?: number;
  consecutiveHits?: number;
  consecutiveHitsRequired?: number;
  hoursSinceFloor?: number | null;
  attributionLagHours?: number;
  insightsAgeMin?: number;
  shopifyAgeMin?: number;
  metaTokenOk?: boolean;
  adsetActive?: boolean;
  exempt?: boolean;
  snoozed?: boolean;
};

export type GuardEvalResult = {
  formulaVersion: string;
  verdict: GuardVerdict;
  reasonCodes: string[];
  inputs: {
    S: number;
    N_meta: number;
    R_meta: number;
    N_shop: number;
    CM_shop: number;
    BE_CPA: number | null;
    m: number;
    k: number;
    F: number;
    tol: number;
    Net_shop: number;
    Net_meta: number;
    Net_best: number;
    consecutiveHits: number;
    hoursSinceFloor: number | null;
  };
};

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

export function evaluateDualSignal(input: GuardEvalInput): GuardEvalResult {
  const k = clamp(input.breakEvenMultiplier ?? 1.75, 1.5, 2);
  const minFloor = input.minSpendFloor ?? 10;
  const lossTolPct = input.lossTolerancePct ?? 0.25;
  const hitsRequired = input.consecutiveHitsRequired ?? 2;
  const lagHours = input.attributionLagHours ?? 3;
  const consecutiveHits = input.consecutiveHits ?? 0;
  const hoursSinceFloor = input.hoursSinceFloor ?? null;
  const m = clamp(input.marginRatio, 0, 0.95);

  const be = input.beCpa;
  const F = be == null ? minFloor : Math.max(k * be, minFloor);
  const tol = be == null ? 0 : lossTolPct * be;
  const S = input.spend;
  const Net_shop = input.cmShop - S;
  const Net_meta = input.rMeta * m - S;
  const Net_best = Math.max(Net_shop, Net_meta);

  const baseInputs = {
    S,
    N_meta: input.nMeta,
    R_meta: input.rMeta,
    N_shop: input.nShop,
    CM_shop: input.cmShop,
    BE_CPA: be,
    m,
    k,
    F,
    tol,
    Net_shop,
    Net_meta,
    Net_best,
    consecutiveHits,
    hoursSinceFloor,
  };

  const reasons: string[] = [];

  if (input.metaTokenOk === false) reasons.push("META_TOKEN");
  if ((input.insightsAgeMin ?? 0) > 90) reasons.push("INSIGHTS_STALE");
  if ((input.shopifyAgeMin ?? 0) > 120) reasons.push("SHOPIFY_STALE");
  if (input.adsetActive === false) reasons.push("ADSET_INACTIVE");
  if (be == null) reasons.push("COSTS_UNKNOWN");
  if (input.exempt) reasons.push("EXEMPT");
  if (input.snoozed) reasons.push("SNOOZED");

  if (reasons.length) {
    return {
      formulaVersion: FORMULA_VERSION,
      verdict: "BLOCKED_DATA",
      reasonCodes: reasons,
      inputs: baseInputs,
    };
  }

  let verdict: GuardVerdict;
  if (S < F) {
    verdict = "HOLD_LEARNING";
    reasons.push("BELOW_FLOOR");
  } else if (input.nMeta === 0 && input.nShop === 0) {
    verdict = "CANDIDATE_NO_SALE";
    reasons.push("NO_SALES");
  } else if (Net_best < -tol) {
    verdict = "CANDIDATE_NEGATIVE_NET";
    reasons.push("BOTH_NEGATIVE");
  } else if (Net_shop < -tol && Net_meta >= -tol) {
    verdict = "HOLD_DISAGREE";
    reasons.push("UTM_GAP_LIKELY");
  } else {
    verdict = "HEALTHY";
    reasons.push("PASS");
  }

  const isCandidate = verdict === "CANDIDATE_NO_SALE" || verdict === "CANDIDATE_NEGATIVE_NET";
  if (isCandidate) {
    const hitsOk = consecutiveHits >= hitsRequired;
    const lagOk = hoursSinceFloor != null && hoursSinceFloor >= lagHours;
    if (!hitsOk || !lagOk) {
      return {
        formulaVersion: FORMULA_VERSION,
        verdict: "HOLD_LAG",
        reasonCodes: [
          ...reasons,
          !hitsOk ? "WAIT_HITS" : "",
          !lagOk ? "WAIT_LAG" : "",
        ].filter(Boolean),
        inputs: baseInputs,
      };
    }
  }

  return {
    formulaVersion: FORMULA_VERSION,
    verdict,
    reasonCodes: reasons,
    inputs: baseInputs,
  };
}
