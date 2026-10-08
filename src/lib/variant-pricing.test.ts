import { describe, expect, it } from "vitest";
import { retailEnding } from "./money";
import {
  isAccessoryOutlier,
  partitionVariants,
  scaleVariantPrices,
  uniquifyVariantNames,
} from "./variant-pricing";

describe("variant-pricing", () => {
  it("flags brush-priced accessories vs main SKUs", () => {
    const costs = [22, 23, 24, 2.5];
    expect(isAccessoryOutlier(2.5, costs)).toBe(true);
    expect(isAccessoryOutlier(22, costs)).toBe(false);
  });

  it("partitions accessories out of primary variants", () => {
    const { primary, accessories } = partitionVariants([
      { cost: 22, name: "White / 1500mAh" },
      { cost: 23, name: "Black / 1500mAh" },
      { cost: 2.5, name: "1PC Cup Brush" },
    ]);
    expect(primary).toHaveLength(2);
    expect(accessories).toHaveLength(1);
  });

  it("scales accessory price below hero retail", () => {
    const prices = scaleVariantPrices(
      [{ cost: 22 }, { cost: 2.5 }],
      34.99,
      2.49,
      3,
    );
    expect(prices[0]).toBeCloseTo(34.99, 1);
    expect(prices[1]!).toBeLessThan(15);
  });

  it("applies the entered price to the cheapest primary and rounds others to retail endings", () => {
    const prices = scaleVariantPrices(
      [{ cost: 4.19 }, { cost: 16.6 }, { cost: 27.39 }],
      49.99,
      0,
      3,
    );
    expect(prices[0]).toBeCloseTo(49.99, 2);
    const markup = 49.99 / 4.19;
    expect(prices[1]).toBe(retailEnding(16.6 * markup));
    expect(prices[2]).toBe(retailEnding(27.39 * markup));
    expect(String(prices[1])).toMatch(/\.99$|\.49$/);
  });

  it("sorts cheapest primary first after partition", () => {
    const { primary } = partitionVariants([
      { cost: 16.6, name: "4-pack" },
      { cost: 4.19, name: "1pcs" },
      { cost: 27.39, name: "6-pack" },
    ]);
    expect(primary[0]?.cost).toBe(4.19);
  });

  it("uniquifies duplicate variant names", () => {
    expect(uniquifyVariantNames(["1500mAh", "1500mAh", "White"])).toEqual([
      "1500mAh",
      "1500mAh (2)",
      "White",
    ]);
  });
});
