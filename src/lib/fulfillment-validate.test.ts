import { describe, expect, it } from "vitest";
import { validateSupplierOrderId, validateTracking } from "./fulfillment-validate";

describe("validateSupplierOrderId", () => {
  it("requires a real supplier id for live orders", () => {
    expect(validateSupplierOrderId("").ok).toBe(false);
    expect(validateSupplierOrderId("ab").ok).toBe(false);
    expect(validateSupplierOrderId("SUP-123456").ok).toBe(false);
    expect(validateSupplierOrderId("AE88214567").ok).toBe(true);
  });

  it("allows short placeholders only for practice", () => {
    expect(validateSupplierOrderId("x", { practice: true }).ok).toBe(true);
  });
});

describe("validateTracking", () => {
  it("requires min length and carrier", () => {
    expect(validateTracking("12345", "YunExpress").ok).toBe(false);
    expect(validateTracking("YT1234567890", "").ok).toBe(false);
    expect(validateTracking("YT1234567890", "YunExpress").ok).toBe(true);
  });
});
