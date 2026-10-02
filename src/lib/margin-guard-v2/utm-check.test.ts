import { describe, expect, it } from "vitest";
import { checkAdUtm, REQUIRED_UTM_PARAMS } from "./utm-check";

const shop = { shopDomain: "test.myshopify.com", primaryDomain: "shop.example.com" };

describe("UTM checker", () => {
  it("passes the recommended parameter string on a product page", () => {
    const r = checkAdUtm({
      landingUrl: "https://shop.example.com/products/widget",
      urlTags: REQUIRED_UTM_PARAMS,
      adsetId: "12345",
      shop,
    });
    expect(r.status).toBe("OK");
  });

  it("errors when utm_term is missing", () => {
    const r = checkAdUtm({
      landingUrl: "https://shop.example.com/products/widget",
      urlTags: "utm_source=facebook&utm_campaign={{campaign.id}}&utm_content={{ad.id}}",
      adsetId: "12345",
      shop,
    });
    expect(r.status).toBe("ERROR");
    expect(r.issues.some((i) => i.code === "MISSING_ADSET_ID")).toBe(true);
  });

  it("warns on adset.name macros", () => {
    const r = checkAdUtm({
      landingUrl: "https://shop.example.com/products/widget",
      urlTags:
        "utm_source=facebook&utm_medium=paid_social&utm_campaign={{campaign.id}}&utm_term={{adset.name}}&utm_content={{ad.id}}",
      adsetId: "12345",
      shop,
    });
    expect(r.status).toBe("WARN");
    expect(r.issues.some((i) => i.code === "ADSET_NAME_MACRO")).toBe(true);
  });

  it("errors on single-brace macro typos", () => {
    const r = checkAdUtm({
      landingUrl: "https://shop.example.com/products/widget",
      urlTags: "utm_source=facebook&utm_term={adset.id}&utm_campaign={{campaign.id}}&utm_content={{ad.id}}",
      adsetId: "12345",
      shop,
    });
    expect(r.status).toBe("ERROR");
    expect(r.issues.some((i) => i.code === "SINGLE_BRACE_MACRO")).toBe(true);
  });
});
