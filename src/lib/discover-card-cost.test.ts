import { describe, expect, it } from "vitest";
import { discoverCardCost } from "./discover-card-cost";
import type { FeedProduct } from "./supplier-feed";

function item(partial: Partial<FeedProduct> & Pick<FeedProduct, "id" | "cost">): FeedProduct {
  return {
    title: "Portable Blender",
    cleanTitle: "Portable Blender",
    url: "https://www.aliexpress.com/item/1.html",
    source: "aliexpress",
    supplierName: "AliExpress",
    niche: "general",
    shipping: 2,
    shippingDays: 7,
    stock: 100,
    stockKnown: true,
    demand: 0.5,
    image: "",
    tags: [],
    live: true,
    variants: [],
    ...partial,
  };
}

describe("discoverCardCost", () => {
  it("ignores accessory SKUs when taking the card min cost", () => {
    const card = discoverCardCost(
      item({
        id: "a",
        cost: 7.58,
        stockKnown: true,
        variants: [
          { skuId: "1", attributes: "Black", cost: 28.05, stock: 100 },
          { skuId: "2", attributes: "Pink", cost: 29.83, stock: 95 },
          { skuId: "3", attributes: "1PC Cup Brush", cost: 7.58, stock: 8 },
        ],
      }),
    );
    expect(card.verified).toBe(true);
    expect(card.cost).toBe(28.05);
    expect(card.accessoriesExcluded).toBe(1);
  });

  it("does not treat unverified feed prices as sellable cost", () => {
    const card = discoverCardCost(
      item({
        id: "b",
        cost: 3.77,
        stockKnown: false,
        shippingDays: 0,
        stock: 0,
        variants: [{ skuId: "1", attributes: "Default", cost: 3.77, stock: 0 }],
      }),
    );
    expect(card.verified).toBe(false);
    expect(card.cost).toBe(0);
    expect(card.estimate).toBe(3.77);
  });
});
