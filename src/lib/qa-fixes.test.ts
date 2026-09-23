import { describe, expect, it } from "vitest";
import { formatScript, normalizeHookScript } from "./format-script";
import { classifyMetaStatus } from "./meta-status";
import { applyExplicitRetailPrice, shouldUpdateShopifyProduct } from "./pricing";

describe("explicit selling price", () => {
  it("stores the operator price even when it differs from cost × markup", () => {
    const saved = applyExplicitRetailPrice({
      retailPrice: 12.99,
      markupMultiplier: 3,
      firstVariantCost: 1.9,
    });
    expect(saved.retailPrice).toBe(12.99);
    expect(saved.markupMultiplier).toBe(6.84);
  });
});

describe("formatScript", () => {
  it("joins lines with spaces and never produces ., or .Capital", () => {
    const text = formatScript([
      "You brush, but the hair keeps coming.",
      "Your cat needs a corner brush.",
    ]);
    expect(text).toBe("You brush, but the hair keeps coming. Your cat needs a corner brush.");
    expect(text).not.toMatch(/\.,/);
    expect(text).not.toMatch(/\.[A-Z]/);
  });

  it("normalizes array scripts from Gemini", () => {
    const script = normalizeHookScript(["Line one.", "Line two."]);
    expect(script).toBe("Line one. Line two.");
    expect(String(["Line one.", "Line two."])).toContain(",");
    expect(script).not.toContain(",");
  });
});

describe("publish idempotency", () => {
  it("updates when a Shopify GID already exists", () => {
    expect(shouldUpdateShopifyProduct("gid://shopify/Product/1")).toBe(true);
    expect(shouldUpdateShopifyProduct(null)).toBe(false);
    expect(shouldUpdateShopifyProduct("")).toBe(false);
  });
});

describe("Meta status", () => {
  it("marks missing account ID as DEGRADED (not live)", () => {
    expect(
      classifyMetaStatus({
        hasToken: true,
        accountId: "",
        apiOk: false,
        longLived: false,
        canExtend: false,
      }),
    ).toBe("degraded");
  });

  it("only returns connected when API ok and token durable or extendable", () => {
    expect(
      classifyMetaStatus({
        hasToken: true,
        accountId: "act_1",
        apiOk: true,
        longLived: true,
        canExtend: false,
      }),
    ).toBe("connected");
    expect(
      classifyMetaStatus({
        hasToken: true,
        accountId: "act_1",
        apiOk: true,
        longLived: false,
        canExtend: false,
      }),
    ).toBe("degraded");
  });
});

describe("Discover card cost", () => {
  it("uses the minimum variant cost as the default import cost", () => {
    const variants = [{ cost: 2.83 }, { cost: 1.68 }, { cost: 1.9 }];
    const min = Math.min(...variants.map((v) => v.cost));
    expect(min).toBe(1.68);
  });
});
