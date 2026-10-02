import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyShopifyHmac } from "./verify";

describe("verifyShopifyHmac", () => {
  const secret = "shpss_test_secret";
  const raw = '{"id":1042}';
  const hmac = createHmac("sha256", secret).update(raw, "utf8").digest("base64");

  it("accepts a valid HMAC", () => {
    expect(verifyShopifyHmac(raw, hmac, secret)).toBe(true);
  });

  it("rejects an invalid HMAC", () => {
    expect(verifyShopifyHmac(raw, "not-valid", secret)).toBe(false);
    expect(verifyShopifyHmac(raw, hmac, "other")).toBe(false);
  });
});
