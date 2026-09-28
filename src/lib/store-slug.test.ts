import { describe, expect, it } from "vitest";
import { storeHomePath, storefrontPath, suggestStoreSlug } from "./store-slug";

describe("store slug", () => {
  it("puts every named shop under /s/slug so shoppers never hit the demo /store", () => {
    expect(storeHomePath("seto")).toBe("/s/seto");
    expect(storeHomePath("")).toBe("/store");
    expect(storefrontPath("phani", "cart")).toBe("/s/phani/cart");
  });

  it("puts later shops under /s/slug", () => {
    expect(storeHomePath("ada-shop")).toBe("/s/ada-shop");
    expect(suggestStoreSlug("Ada Shop", "ada@example.com")).toBe("ada-shop");
  });
});
