import { describe, expect, it } from "vitest";
import { todayKey } from "./utils";

describe("store timezone day buckets", () => {
  it("buckets late-evening UTC into the prior Chicago calendar day", () => {
    // 2026-03-15 04:30 UTC = 2026-03-14 23:30 America/Chicago (CDT)
    const iso = "2026-03-15T04:30:00.000Z";
    expect(todayKey("America/Chicago", iso)).toBe("2026-03-14");
    expect(iso.slice(0, 10)).toBe("2026-03-15");
  });

  it("differs from a naive UTC date slice", () => {
    const iso = "2026-03-15T04:30:00.000Z";
    expect(todayKey("UTC", iso)).toBe("2026-03-15");
    expect(todayKey("America/Chicago", iso)).not.toBe(todayKey("UTC", iso));
  });
});
