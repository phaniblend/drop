import { describe, expect, it } from "vitest";
import { MAX_STORE_LINE_QTY, validateStoreQty } from "./store-qty";

describe("store checkout qty", () => {
  it("rejects non-integers and values below 1", () => {
    expect(validateStoreQty(-1, 15).ok).toBe(false);
    expect(validateStoreQty(0, 15).ok).toBe(false);
    expect(validateStoreQty(1.5, 15).ok).toBe(false);
    expect(validateStoreQty("2", 15).ok).toBe(false);
  });

  it("rejects sold-out and over-stock qty instead of capping silently", () => {
    expect(validateStoreQty(1, 0)).toEqual({ ok: false, error: "That option is sold out." });
    expect(validateStoreQty(1000, 15)).toEqual({ ok: false, error: "Only 15 left." });
    expect(validateStoreQty(21, 99)).toEqual({
      ok: false,
      error: `You can buy at most ${MAX_STORE_LINE_QTY} of this item.`,
    });
  });

  it("accepts a whole number within stock", () => {
    expect(validateStoreQty(3, 15)).toEqual({ ok: true, qty: 3 });
  });
});
