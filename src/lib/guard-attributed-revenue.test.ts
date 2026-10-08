import { describe, expect, it } from "vitest";
import { guardAttributedRevenue } from "./guard-attributed-revenue";

describe("guardAttributedRevenue", () => {
  const productId = "prod_1";
  const todayIso = new Date().toISOString();

  it("ignores PRACTICE orders when overlaying desk revenue", () => {
    const revenue = guardAttributedRevenue({
      storedRevenueToday: 0,
      productId,
      timeZone: "America/Chicago",
      orders: [
        {
          totalRevenue: 49.99,
          createdAt: todayIso,
          orderNumber: "PRACTICE-ABC123",
          shopifyOrderId: "practice_ord_1",
          items: [{ productId }],
        },
        {
          totalRevenue: 24.5,
          createdAt: todayIso,
          orderNumber: "S-REAL1",
          shopifyOrderId: "stripe_cs_1",
          items: [{ productId }],
        },
      ],
    });
    expect(revenue).toBe(24.5);
  });

  it("keeps stored Meta revenue when higher than desk", () => {
    expect(
      guardAttributedRevenue({
        storedRevenueToday: 100,
        productId,
        orders: [],
      }),
    ).toBe(100);
  });
});
