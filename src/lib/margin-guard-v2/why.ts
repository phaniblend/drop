/** Human copy for dual-signal reason codes (Ads & Guard Why? panel). */

const REASON_COPY: Record<string, string> = {
  META_TOKEN: "Meta token is missing or expired — reconnect in Settings.",
  INSIGHTS_STALE: "Meta insights are older than 90 minutes — waiting for the next sync.",
  SHOPIFY_STALE: "Shopify order sync is stale — Guard will not pause until orders catch up.",
  ADSET_INACTIVE: "This ad set is not active in Meta.",
  COSTS_UNKNOWN: "Product costs are unknown — import COGS or set a default margin.",
  EXEMPT: "This ad set is marked exempt from auto-pause.",
  SNOOZED: "Guard is snoozed for this ad set.",
  BELOW_FLOOR: "Spend is still below the break-even floor — still learning.",
  NO_SALES: "Spend crossed the floor with zero Meta and zero Shopify sales.",
  BOTH_NEGATIVE: "Both Meta and Shopify net contribution are below the loss tolerance.",
  UTM_GAP_LIKELY: "Shopify looks negative but Meta still looks healthy — likely a UTM gap; holding.",
  PASS: "Best-of Meta/Shopify net is within tolerance.",
  WAIT_HITS: "Waiting for consecutive losing checks before pause.",
  WAIT_LAG: "Waiting out the attribution lag window before pause.",
};

export function explainReasonCode(code: string) {
  return REASON_COPY[code] || code.replace(/_/g, " ").toLowerCase();
}

export function explainVerdict(verdict: string) {
  switch (verdict) {
    case "HOLD_LEARNING":
      return "Still learning — spend has not crossed the floor yet.";
    case "HOLD_DISAGREE":
      return "Signals disagree — one channel looks fine, so Guard holds.";
    case "HOLD_LAG":
      return "Holding for attribution lag before any pause.";
    case "HEALTHY":
      return "Healthy — best net contribution is within tolerance.";
    case "CANDIDATE_NO_SALE":
      return "Pause candidate — spend with no sales.";
    case "CANDIDATE_NEGATIVE_NET":
      return "Pause candidate — both nets are losing money.";
    case "BLOCKED_DATA":
      return "Blocked — missing or stale data; Guard will not pause.";
    default:
      return verdict;
  }
}
