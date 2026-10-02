import { describe, expect, it } from "vitest";
import { reconcileIsStale } from "./reconcile";

describe("shopify reconcile", () => {
  it("treats missing or >2h-old marks as stale", () => {
    const now = Date.parse("2026-09-28T12:00:00.000Z");
    expect(reconcileIsStale(null, now)).toBe(true);
    expect(reconcileIsStale("2026-09-28T09:00:00.000Z", now)).toBe(true);
    expect(reconcileIsStale("2026-09-28T11:00:00.000Z", now)).toBe(false);
  });
});
