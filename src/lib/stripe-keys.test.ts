import { describe, expect, it } from "vitest";
import { classifyStripeKeyPair, maskStripeKey, stripeKeyMode } from "./stripe-keys";

describe("stripe key pair", () => {
  it("accepts matching live keys and rejects test or mixed pairs for live setup", () => {
    expect(stripeKeyMode("sk_live_abc")).toBe("live");
    expect(stripeKeyMode("pk_test_abc")).toBe("test");
    expect(classifyStripeKeyPair("pk_live_pub", "sk_live_sec")).toEqual({
      ok: true,
      mode: "live",
      error: null,
    });
    expect(classifyStripeKeyPair("pk_test_pub", "sk_test_sec").mode).toBe("test");
    expect(classifyStripeKeyPair("pk_live_pub", "sk_test_sec").ok).toBe(false);
    expect(classifyStripeKeyPair("pk_live_pub", "not-a-key").ok).toBe(false);
  });

  it("masks stored secrets for the settings form", () => {
    expect(maskStripeKey("sk_live_1234567890abcd")).toBe("sk_live…abcd");
  });
});
