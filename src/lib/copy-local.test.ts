import { describe, expect, it } from "vitest";
import { discoverCardTitle } from "./copy-local";

describe("copy-local titles", () => {
  it("keeps 8000mAh in discoverCardTitle", () => {
    const title = discoverCardTitle("8000mah Usb Hanging Neck Fan");
    expect(title).toMatch(/8000mAh/);
    expect(title).not.toMatch(/^Ah\b/);
  });

  it("keeps pack counts and drops leading/trailing junk words", () => {
    expect(discoverCardTitle("2PCS Car Seat Gap Filler Between Seats Console")).toMatch(/2pcs|2-Pack|2Pcs/i);
    expect(discoverCardTitle("For Citroen C6 C4 I Car Seat Gap")).not.toMatch(/^For\b/i);
    expect(discoverCardTitle("In LED Under Cabinet Lights Motion Sensor Night")).not.toMatch(/^In\b/i);
    expect(discoverCardTitle("2026 New Portable Waist Fan With Power")).not.toMatch(/2026|New Portable/i);
  });
});
