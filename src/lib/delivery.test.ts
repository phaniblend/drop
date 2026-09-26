import { describe, expect, it } from "vitest";
import { deliveryWindow } from "./delivery";

describe("deliveryWindow", () => {
  it("never advertises faster than processing plus a 7-day transit floor", () => {
    expect(deliveryWindow(3)).toEqual(
      expect.objectContaining({ low: 8, high: 16, text: "Delivers in 8–16 days" }),
    );
    expect(deliveryWindow(7).text).toBe("Delivers in 8–16 days");
  });

  it("grows with longer supplier transit", () => {
    expect(deliveryWindow(14)).toEqual(
      expect.objectContaining({ low: 15, high: 23, text: "Delivers in 15–23 days" }),
    );
  });
});
