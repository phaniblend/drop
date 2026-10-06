import { describe, expect, it } from "vitest";
import { canOpenProfinder } from "./profinder-allow";

describe("profinder access", () => {
  it("allows the superuser and the named finder only", () => {
    expect(canOpenProfinder("bsit.setty@gmail.com")).toBe(true);
    expect(canOpenProfinder("dhanraydbs@gmail.com")).toBe(true);
    expect(canOpenProfinder("DHANRAYDBS@gmail.com")).toBe(true);
    expect(canOpenProfinder("anyone@gmail.com")).toBe(false);
    expect(canOpenProfinder(null)).toBe(false);
  });
});
