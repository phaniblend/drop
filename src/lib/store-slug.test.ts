import { describe, expect, it } from "vitest";
import { storeHomePath, suggestStoreSlug } from "./store-slug";

describe("store slug", () => {
  it("keeps the original shop at /store", () => {
    expect(storeHomePath("seto")).toBe("/store");
    expect(storeHomePath("")).toBe("/store");
  });

  it("puts later shops under /s/slug", () => {
    expect(storeHomePath("ada-shop")).toBe("/s/ada-shop");
    expect(suggestStoreSlug("Ada Shop", "ada@example.com")).toBe("ada-shop");
  });
});
