import { describe, expect, it } from "vitest";
import { extractPriceFromChunk } from "./aliexpress-search-html";

describe("extractPriceFromChunk", () => {
  it("reads salePrice.minPrice instead of originalPrice.minPrice", () => {
    const chunk = JSON.stringify({
      prices: {
        originalPrice: { minPrice: 43.08 },
        salePrice: { minPrice: 21.54 },
      },
    });
    expect(extractPriceFromChunk(chunk)).toBe("21.54");
  });

  it("still reads scalar salePrice strings", () => {
    expect(extractPriceFromChunk(`"salePrice":"12.34"`)).toBe("12.34");
  });
});
