import { describe, expect, it } from "vitest";
import { asFeedProduct, savedListingKey } from "./saved-listing";

describe("saved listings", () => {
  it("keys AliExpress items by product id so a later search still matches", () => {
    expect(
      savedListingKey({
        id: "ali_1",
        url: "https://www.aliexpress.com/item/1005001234.html?algo=xx",
      }),
    ).toBe("1005001234");
  });

  it("rejects a broken snapshot", () => {
    expect(asFeedProduct({ title: "only" })).toBeNull();
    expect(asFeedProduct({ id: "x", url: "https://x.com", title: "Chair" })?.title).toBe("Chair");
  });
});
