import { stripeCheckoutMode } from "./stripe-mode";

export type StripeBillingHealth = {
  mode: "off" | "test" | "live";
  hasSecret: boolean;
  hasWebhook: boolean;
  hasStarterPrice: boolean;
  hasScalerPrice: boolean;
  /** Live secret + both prices + webhook — real subscription charges. */
  liveReady: boolean;
  /** Test secret + both prices — sandbox upgrades only. */
  testReady: boolean;
};

export function stripeBillingHealth(input: {
  secretKey?: string | null;
  webhookSecret?: string | null;
  starterPrice?: string | null;
  scalerPrice?: string | null;
}): StripeBillingHealth {
  const secret = (input.secretKey ?? "").trim();
  const webhook = (input.webhookSecret ?? "").trim();
  const starter = (input.starterPrice ?? "").trim();
  const scaler = (input.scalerPrice ?? "").trim();
  const mode = stripeCheckoutMode(secret);
  const hasSecret = Boolean(secret);
  const hasWebhook = Boolean(webhook);
  const hasStarterPrice = starter.startsWith("price_");
  const hasScalerPrice = scaler.startsWith("price_");
  const prices = hasStarterPrice && hasScalerPrice;
  return {
    mode,
    hasSecret,
    hasWebhook,
    hasStarterPrice,
    hasScalerPrice,
    liveReady: mode === "live" && prices && hasWebhook,
    testReady: mode === "test" && prices,
  };
}

export function mapStripeSubscriptionStatus(status?: string | null) {
  const value = (status ?? "").toLowerCase();
  if (value === "active" || value === "trialing") return "active" as const;
  if (value === "past_due" || value === "unpaid" || value === "incomplete") return "past_due" as const;
  if (value === "canceled" || value === "incomplete_expired") return "canceled" as const;
  return "active" as const;
}

export function planFromStripeMetadata(plan?: string | null): "starter" | "scaler" {
  return plan === "scaler" ? "scaler" : "starter";
}
