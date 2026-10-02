import { describe, expect, it } from "vitest";
import { evaluateDualSignal } from "./evaluate";

/** Spec §3.10: BE_CPA = 17.90, k = 1.75 → F = 31.33, tol = 4.48, m = 0.41 */
const base = {
  beCpa: 17.9,
  marginRatio: 0.41,
  breakEvenMultiplier: 1.75,
  minSpendFloor: 10,
  lossTolerancePct: 0.25,
  consecutiveHits: 2,
  consecutiveHitsRequired: 2,
  hoursSinceFloor: 3.4,
  attributionLagHours: 3,
  insightsAgeMin: 12,
  shopifyAgeMin: 21,
  metaTokenOk: true,
  adsetActive: true,
};

describe("dual-signal Margin Guard mg-2.0.0", () => {
  it("1: below spend floor → HOLD_LEARNING", () => {
    const r = evaluateDualSignal({ ...base, spend: 20, nMeta: 0, rMeta: 0, nShop: 0, cmShop: 0 });
    expect(r.verdict).toBe("HOLD_LEARNING");
    expect(r.inputs.F).toBeCloseTo(31.325, 2);
  });

  it("2: spent past floor with zero sales → CANDIDATE_NO_SALE", () => {
    const r = evaluateDualSignal({ ...base, spend: 38.4, nMeta: 0, rMeta: 0, nShop: 0, cmShop: 0 });
    expect(r.verdict).toBe("CANDIDATE_NO_SALE");
  });

  it("3: Meta under water → CANDIDATE_NEGATIVE_NET", () => {
    const r = evaluateDualSignal({ ...base, spend: 38.4, nMeta: 1, rMeta: 43.99, nShop: 0, cmShop: 0 });
    expect(r.inputs.Net_meta).toBeCloseTo(-20.36, 1);
    expect(r.verdict).toBe("CANDIDATE_NEGATIVE_NET");
  });

  it("4: Meta ok, Shopify losing → HOLD_DISAGREE", () => {
    const r = evaluateDualSignal({ ...base, spend: 38.4, nMeta: 2, rMeta: 87.98, nShop: 0, cmShop: 0 });
    expect(r.verdict).toBe("HOLD_DISAGREE");
  });

  it("4b: both near break-even → HEALTHY", () => {
    const r = evaluateDualSignal({ ...base, spend: 38.4, nMeta: 2, rMeta: 87.98, nShop: 2, cmShop: 35.8 });
    expect(r.verdict).toBe("HEALTHY");
  });

  it("5: both net negative beyond tol → CANDIDATE_NEGATIVE_NET", () => {
    const r = evaluateDualSignal({ ...base, spend: 60, nMeta: 3, rMeta: 131.97, nShop: 1, cmShop: 17.9 });
    expect(r.verdict).toBe("CANDIDATE_NEGATIVE_NET");
  });

  it("6: Meta profitable, Shopify losing → HOLD_DISAGREE", () => {
    const r = evaluateDualSignal({ ...base, spend: 60, nMeta: 4, rMeta: 175.96, nShop: 1, cmShop: 17.9 });
    expect(r.verdict).toBe("HOLD_DISAGREE");
  });

  it("7: one shop order still negative → CANDIDATE_NEGATIVE_NET", () => {
    const r = evaluateDualSignal({ ...base, spend: 38.4, nMeta: 0, rMeta: 0, nShop: 1, cmShop: 17.9 });
    expect(r.verdict).toBe("CANDIDATE_NEGATIVE_NET");
  });

  it("8: first candidate hit waits for hysteresis → HOLD_LAG", () => {
    const r = evaluateDualSignal({
      ...base,
      spend: 38.4,
      nMeta: 0,
      rMeta: 0,
      nShop: 0,
      cmShop: 0,
      consecutiveHits: 1,
    });
    expect(r.verdict).toBe("HOLD_LAG");
  });

  it("9: stale insights → BLOCKED_DATA", () => {
    const r = evaluateDualSignal({
      ...base,
      spend: 38.4,
      nMeta: 0,
      rMeta: 0,
      nShop: 0,
      cmShop: 0,
      insightsAgeMin: 180,
    });
    expect(r.verdict).toBe("BLOCKED_DATA");
    expect(r.reasonCodes).toContain("INSIGHTS_STALE");
  });
});
