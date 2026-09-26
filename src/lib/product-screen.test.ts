import { describe, expect, it } from "vitest";
import { screenListing } from "./product-screen";

describe("screenListing", () => {
  it("blocks supplements by default", () => {
    expect(screenListing({ title: "Omega 3 Fish Oil" }).level).toBe("block");
  });

  it("flags medical claims and brand names for review", () => {
    expect(screenListing({ title: "Jessup makeup brushes" }).level).toBe("review");
    expect(screenListing({ title: "Scoliosis Corrector", description: "alleviate discomfort" }).level).toBe(
      "review",
    );
  });

  it("allows ordinary housewares", () => {
    expect(screenListing({ title: "Gravity Car Phone Holder" }).ok).toBe(true);
  });
});
