import { describe, expect, it } from "vitest";
import { screenListing } from "./product-screen";

describe("screenListing", () => {
  it("blocks supplements by default", () => {
    const hit = screenListing({ title: "Omega 3 Fish Oil" });
    expect(hit.level).toBe("block");
    expect(hit.ok).toBe(false);
    if (!hit.ok) expect(hit.reason).toMatch(/supplement|fish oil|terms/i);
  });

  it("flags medical claims and brand names for review", () => {
    expect(screenListing({ title: "Jessup makeup brushes" }).level).toBe("review");
    expect(screenListing({ title: "Xiaomi Mijia Portable Juicer" }).level).toBe("review");
    expect(screenListing({ title: "Scoliosis Corrector", description: "alleviate discomfort" }).level).toBe(
      "review",
    );
  });

  it("allows ordinary housewares", () => {
    expect(screenListing({ title: "Gravity Car Phone Holder" }).ok).toBe(true);
  });
});
