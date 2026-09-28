import { describe, expect, it } from "vitest";
import { discoverShipping, plausibleDiscoverCost } from "./discover-cost";

describe("discover cost", () => {
  it("drops pack/currency outliers so lint rollers are not $55+", () => {
    expect(plausibleDiscoverCost(3.2)).toBe(3.2);
    expect(plausibleDiscoverCost(55)).toBe(0);
    expect(plausibleDiscoverCost(72.4)).toBe(0);
    expect(plausibleDiscoverCost(0)).toBe(0);
  });

  it("estimates ship when the feed omits freight", () => {
    expect(discoverShipping(0)).toBe(2.49);
    expect(discoverShipping(1.99)).toBe(1.99);
  });
});
