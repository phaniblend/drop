/** Plain-English copy for dual-signal reason codes (Ads & Guard Why? panel). */

const REASON_COPY: Record<string, string> = {
  META_TOKEN: "Reconnect Meta in Settings — Guard can’t see spend until the token works.",
  INSIGHTS_STALE: "Meta numbers are a bit old. Guard waits for the next sync before pausing.",
  SHOPIFY_STALE: "Store order sync is behind. Guard won’t pause until sales catch up.",
  ADSET_INACTIVE: "This ad set is already off in Meta.",
  COSTS_UNKNOWN: "Set product cost so Guard knows your real margin.",
  EXEMPT: "You marked this ad set exempt from auto-pause.",
  SNOOZED: "Guard is snoozed on this ad set for now.",
  BELOW_FLOOR: "Still learning — spend hasn’t hit your safety floor yet.",
  NO_SALES: "Spend crossed the floor with no sales from Meta or your store.",
  BOTH_NEGATIVE: "Meta and your store both show this ad losing money.",
  UTM_GAP_LIKELY: "Store looks soft but Meta still looks fine — likely a tracking gap, so Guard holds.",
  PASS: "Best of Meta / store profit is still within your tolerance.",
  WAIT_HITS: "Needs a few losing checks in a row before a pause.",
  WAIT_LAG: "Waiting a short attribution window before pausing.",
};

export function explainReasonCode(code: string) {
  return REASON_COPY[code] || code.replace(/_/g, " ").toLowerCase();
}

export function explainVerdict(verdict: string) {
  switch (verdict) {
    case "HOLD_LEARNING":
      return "Still learning — spend has not crossed your floor yet.";
    case "HOLD_DISAGREE":
      return "Signals disagree — one channel still looks fine, so Guard holds.";
    case "HOLD_LAG":
      return "Holding briefly so late sales can show up.";
    case "HEALTHY":
      return "Healthy — this ad is covering cost within your rules.";
    case "CANDIDATE_NO_SALE":
      return "Would pause — spend with no sales.";
    case "CANDIDATE_NEGATIVE_NET":
      return "Would pause — both Meta and store show a loss.";
    case "BLOCKED_DATA":
      return "Waiting on better data — Guard will not pause yet.";
    default:
      return verdict.replace(/_/g, " ").toLowerCase();
  }
}
