import { describe, expect, it } from "vitest";
import { isPracticeOrder, realOrderRevenue } from "./practice-order";

describe("isPracticeOrder", () => {
  it("flags PRACTICE-* order numbers and practice_ shopify ids", () => {
    expect(isPracticeOrder({ orderNumber: "PRACTICE-AB12CD" })).toBe(true);
    expect(isPracticeOrder({ shopifyOrderId: "practice_ord_abc" })).toBe(true);
    expect(isPracticeOrder({ customerEmail: "practice@seto.store" })).toBe(true);
  });

  it("leaves real store orders alone", () => {
    expect(
      isPracticeOrder({
        orderNumber: "S-2WNFUR",
        shopifyOrderId: "stripe_cs_test_123",
        customerEmail: "buyer@example.com",
      }),
    ).toBe(false);
  });

  it("sums only real revenue", () => {
    expect(
      realOrderRevenue([
        { totalRevenue: 10, orderNumber: "PRACTICE-1" },
        { totalRevenue: 20, orderNumber: "S-1", shopifyOrderId: "stripe_1" },
      ]),
    ).toBe(20);
  });
});
