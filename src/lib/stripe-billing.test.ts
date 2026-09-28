import { describe, expect, it } from "vitest";
import { mapStripeSubscriptionStatus, stripeBillingHealth } from "./stripe-billing";

describe("stripe billing health", () => {
  it("is live-ready only with live secret, both prices, and a webhook", () => {
    expect(
      stripeBillingHealth({
        secretKey: "sk_live_abc",
        webhookSecret: "whsec_abc",
        starterPrice: "price_starter",
        scalerPrice: "price_scaler",
      }).liveReady,
    ).toBe(true);
    expect(
      stripeBillingHealth({
        secretKey: "sk_test_abc",
        webhookSecret: "whsec_abc",
        starterPrice: "price_starter",
        scalerPrice: "price_scaler",
      }).liveReady,
    ).toBe(false);
    expect(
      stripeBillingHealth({
        secretKey: "sk_live_abc",
        webhookSecret: "",
        starterPrice: "price_starter",
        scalerPrice: "price_scaler",
      }).liveReady,
    ).toBe(false);
  });
});

describe("stripe subscription status", () => {
  it("maps failed renewals to past_due", () => {
    expect(mapStripeSubscriptionStatus("past_due")).toBe("past_due");
    expect(mapStripeSubscriptionStatus("unpaid")).toBe("past_due");
    expect(mapStripeSubscriptionStatus("active")).toBe("active");
    expect(mapStripeSubscriptionStatus("canceled")).toBe("canceled");
  });
});
