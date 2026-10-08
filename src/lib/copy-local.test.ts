import { describe, expect, it } from "vitest";
import { discoverCardTitle } from "./copy-local";

describe("copy-local titles", () => {
  it("keeps 8000mAh in discoverCardTitle", () => {
    const title = discoverCardTitle("8000mah Usb Hanging Neck Fan");
    expect(title).toMatch(/8000mAh/);
  });
});
