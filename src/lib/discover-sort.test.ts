import { describe, expect, it } from "vitest";
import { parseSupplierRating, sortDiscoverItems } from "./discover-sort";
import type { FeedProduct } from "./supplier-feed";

function item(partial: Partial<FeedProduct> & Pick<FeedProduct, "id" | "cost">): FeedProduct {
  return {
    title: partial.id,
    cleanTitle: partial.id,
    url: `https://example.com/${partial.id}`,
    source: "aliexpress",
    supplierName: "AliExpress",
    niche: "home",
    shipping: 0,
    shippingDays: 0,
    stock: 10,
    demand: 0.2,
    image: "",
    tags: [],
    variants: [],
    live: true,
    ...partial,
  };
}

describe("parseSupplierRating", () => {
  it("keeps a 5-star score and converts a percent", () => {
    expect(parseSupplierRating("4.8")).toBe(4.8);
    expect(parseSupplierRating("96.7%")).toBe(4.8);
  });
});

describe("sortDiscoverItems", () => {
  const rows = [
    item({ id: "cheap", cost: 3, orders30d: 10, rating: 4, shippingDays: 14 }),
    item({ id: "hot", cost: 8, orders30d: 900, rating: 4.9, shippingDays: 7 }),
    item({ id: "slow", cost: 5, orders30d: 40, rating: 3.2, shippingDays: 20 }),
  ];

  it("sorts by lowest cost and most sold", () => {
    expect(sortDiscoverItems(rows, "cost").map((r) => r.id)).toEqual(["cheap", "slow", "hot"]);
    expect(sortDiscoverItems(rows, "sold").map((r) => r.id)).toEqual(["hot", "slow", "cheap"]);
  });

  it("puts unknown ship last on fastest-ship", () => {
    const mixed = [...rows, item({ id: "unknown", cost: 4, shippingDays: 0 })];
    expect(sortDiscoverItems(mixed, "ship").map((r) => r.id).at(-1)).toBe("unknown");
  });
});
