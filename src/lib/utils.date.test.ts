import { describe, expect, it } from "vitest";
import { checkedAtLabel, shortDate } from "./utils";

describe("store-timezone dates", () => {
  it("formats the same for a fixed IANA zone (hydration-safe)", () => {
    const iso = "2026-10-07T23:59:00.000Z";
    const a = shortDate(iso, "America/Chicago");
    const b = shortDate(iso, "America/Chicago");
    expect(a).toBe(b);
    expect(a).toMatch(/Oct/);
    expect(checkedAtLabel(iso, "America/Chicago")).toBe(a);
  });
});
