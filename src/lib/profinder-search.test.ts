import { describe, expect, it } from "vitest";
import { scoreProspectText } from "./profinder-search";

describe("profinder scoring", () => {
  it("scores dropship plus ad-spend language", () => {
    const hit = scoreProspectText(
      "I tried dropship on Shopify and burned $400 on TikTok ads with no sales. Ready to quit.",
    );
    expect(hit).toBeTruthy();
    expect(hit!.score).toBeGreaterThan(70);
  });

  it("scores side-gig plus store language", () => {
    const hit = scoreProspectText(
      "Looking for a side hustle using Shopify to sell products after my day job. Any advice?",
    );
    expect(hit).toBeTruthy();
  });
});
