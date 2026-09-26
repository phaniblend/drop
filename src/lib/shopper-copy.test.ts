import { describe, expect, it } from "vitest";
import {
  publicHtmlLeaksOperatorCopy,
  sanitizeShopperHtml,
  shopperVariantLabel,
  toPublicProduct,
} from "./shopper-copy";

const LEAKY = `<p>Gravity Car Phone Holder Air Vent is designed for daily use — simple setup, clean look, and a price that still leaves room for ads.</p>
<ul>
<li>You pay about $7.47</li>
<li>Impulse-friendly creative angle</li>
<li>Tracked shipping</li>
<li>Easy returns if it doesn't land</li>
</ul>`;

describe("shopper copy", () => {
  it("strips operator cost and internal notes from HTML", () => {
    const html = sanitizeShopperHtml(LEAKY, "Gravity Car Phone Holder");
    expect(publicHtmlLeaksOperatorCopy(html, 7.47)).toBe(false);
    expect(html).not.toContain("7.47");
    expect(html).not.toMatch(/you pay about/i);
    expect(html).not.toMatch(/room for ads/i);
    expect(html).not.toMatch(/creative angle/i);
    expect(html.toLowerCase()).toContain("gravity car phone holder");
  });

  it("toPublicProduct never exposes cost, supplier, or markup fields", () => {
    const pub = toPublicProduct({
      id: "prod_1",
      cleanTitle: "Gravity Car Phone Holder",
      rawTitle: "Wholesale Gravity Holder 2024",
      descriptionHtml: LEAKY,
      imageUrl: "https://example.com/p.jpg",
      shippingDays: 14,
      retailPrice: 22.41,
      variants: [
        { id: "v1", variantName: "black · United States", variantPrice: 22.41, inventoryCount: 15 },
      ],
    });
    expect(pub).toEqual({
      id: "prod_1",
      title: "Gravity Car Phone Holder",
      descriptionHtml: pub.descriptionHtml,
      imageUrl: "https://example.com/p.jpg",
      shippingDays: 14,
      price: 22.41,
      variants: [{ id: "v1", name: "black", price: 22.41, stock: 15 }],
    });
    expect(JSON.stringify(pub)).not.toContain("7.47");
    expect(JSON.stringify(pub)).not.toMatch(/baseCost|supplierUrl|markup|adAngles/i);
  });

  it("drops ship-from country from shopper variant titles", () => {
    expect(shopperVariantLabel("black · United States")).toBe("black");
    expect(shopperVariantLabel("Red; Ships From")).toBe("Red");
  });

  it("public PDP HTML never includes cost or operator phrases", () => {
    const pub = toPublicProduct({
      id: "prod_bcc3b3d6-f",
      cleanTitle: "Gravity Car Phone Holder Air Vent",
      rawTitle: "Gravity Car Phone Holder Air Vent",
      descriptionHtml: LEAKY,
      imageUrl: null,
      shippingDays: 14,
      retailPrice: 22.41,
      variants: [
        { id: "v1", variantName: "black · United States", variantPrice: 22.41, inventoryCount: 15 },
      ],
    });
    const html = `<h1>${pub.title}</h1><p>${pub.price}</p>${pub.descriptionHtml}${pub.variants.map((v) => v.name).join(" ")}`;
    expect(html).not.toContain("7.47");
    expect(html).not.toMatch(/you pay about|room for ads|creative angle|doesn['’]t land/i);
    expect(html).not.toMatch(/united states/i);
    expect(html).toContain("22.41");
  });
});
