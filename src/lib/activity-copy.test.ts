import { describe, expect, it } from "vitest";
import { operatorHasShopifyOAuth, publishActivityMessage, sanitizeActivityMessage } from "./activity-copy";

describe("activity copy", () => {
  it("normalizes legacy Seto publish lines to one storefront phrase", () => {
    expect(sanitizeActivityMessage("Neck fan is live on your Seto store.")).toBe(
      publishActivityMessage("Neck fan"),
    );
  });

  it("rewrites Shopify GID publishes to the Seto storefront", () => {
    expect(
      sanitizeActivityMessage("Neck fan pushed to Shopify (gid://shopify/Product/9876543210)"),
    ).toBe("Published Neck fan to your Seto Storefront");
  });

  it("keeps a Shopify mention only when OAuth is connected, still strips the GID", () => {
    expect(
      sanitizeActivityMessage("Neck fan pushed to Shopify (gid://shopify/Product/1)", true),
    ).toBe("Neck fan pushed to Shopify");
  });

  it("leaves order webhooks alone", () => {
    expect(sanitizeActivityMessage("Shopify webhook captured #1042.")).toBe(
      "Shopify webhook captured #1042.",
    );
  });

  it("detects an explicit Shopify OAuth pair", () => {
    expect(operatorHasShopifyOAuth({ shopifyDomain: "my-shop", shopifyAccessToken: "shpat_x" })).toBe(true);
    expect(operatorHasShopifyOAuth({ shopifyDomain: "my-shop", shopifyAccessToken: "" })).toBe(false);
  });
});
