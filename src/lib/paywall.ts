export type PaywallCode =
  | "TRIAL_LIMIT_REACHED"
  | "SUBSCRIPTION_PAST_DUE"
  | "LENS_LIMIT_REACHED"
  | "CAMPAIGN_LIMIT_REACHED";

export type PaywallPayload = {
  code: PaywallCode;
  message: string;
  limit?: number;
  used?: number;
  resource?: "products" | "lens" | "campaigns";
};

export type BillingSummary = {
  tier: "trial_5" | "starter" | "scaler";
  status: string;
  productsUsed: number;
  productsLimit: number;
  lensUsed: number;
  lensLimit: number;
  campaignsUsed: number;
  campaignsLimit: number;
  period: "lifetime" | "month";
  label: string;
  stripeReady: boolean;
};

export const PAYWALL_EVENT = "setostore-paywall";

export function emitPaywall(payload: PaywallPayload) {
  window.dispatchEvent(new CustomEvent(PAYWALL_EVENT, { detail: payload }));
}

export function hasPaywall<T extends object>(
  value: T,
): value is T & { paywall: PaywallPayload } {
  return "paywall" in value && Boolean((value as { paywall?: PaywallPayload }).paywall);
}
