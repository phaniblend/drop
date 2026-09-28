import { describe, expect, it } from "vitest";
import { storeCartKey } from "./store-cart";

describe("store cart", () => {
  it("scopes bags per shop so two stores never share a cart", () => {
    expect(storeCartKey("usr_phani")).toBe("seto-store-cart:usr_phani");
    expect(storeCartKey("usr_demo")).toBe("seto-store-cart:usr_demo");
    expect(storeCartKey("")).toBe("seto-store-cart");
  });
});
