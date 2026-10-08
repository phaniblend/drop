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
      userId: undefined,
      title: "Gravity Car Phone Holder",
      descriptionHtml: pub.descriptionHtml,
      imageUrl: "https://example.com/p.jpg",
      gallery: [],
      shippingDays: 14,
      price: 22.41,
      variants: [{ id: "v1", name: "black", price: 22.41, stock: 15, imageUrl: null }],
    });
    expect(JSON.stringify(pub)).not.toContain("7.47");
    expect(JSON.stringify(pub)).not.toMatch(/baseCost|supplierUrl|markup|adAngles/i);
  });

  it("drops ship-from country from shopper variant titles", () => {
    expect(shopperVariantLabel("black · United States")).toBe("black");
    expect(shopperVariantLabel("Red; Ships From")).toBe("Red");
    expect(shopperVariantLabel("S · black · China Mainland")).toBe("S · black");
    expect(shopperVariantLabel("L · grey · China Mainland")).toBe("L · grey");
    expect(shopperVariantLabel("14:1005009182345 · Black")).toBe("Black");
    expect(shopperVariantLabel("1005009182345:14#T0")).toMatch(/^Option \d+$/);
  });

  it("uses a neutral fallback without category claims", () => {
    const html = sanitizeShopperHtml("", "Adjustable Breathable Posture Corrector Belt");
    expect(html).not.toMatch(/bright enough to see at night/i);
    expect(html).not.toMatch(/soft bristles/i);
    expect(html).toMatch(/ships as shown/i);
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

  it("exposes gallery images for the storefront media strip", () => {
    const pub = toPublicProduct({
      id: "prod_g",
      cleanTitle: "Neck Fan",
      rawTitle: "Neck Fan",
      descriptionHtml: "<p>Neck Fan keeps you cool.</p>",
      imageUrl: "https://example.com/hero.jpg",
      galleryJson: JSON.stringify(["https://example.com/a.jpg", "https://example.com/b.jpg"]),
      shippingDays: 10,
      retailPrice: 29,
      variants: [],
    });
    expect(pub.gallery).toEqual(["https://example.com/a.jpg", "https://example.com/b.jpg"]);
  });

  it("strips health-claim lines from shopper HTML", () => {
    const html = sanitizeShopperHtml(
      "<p>Posture belt helps alleviate discomfort from slouching.</p><ul><li>Encourages proper spinal alignment</li><li>Tracked shipping</li></ul>",
      "Posture Support Belt",
    );
    expect(html).not.toMatch(/alleviate|spinal alignment|discomfort/i);
    expect(html.toLowerCase()).toMatch(/posture|daily wear|tracked shipping|adjustable/);
  });
});
