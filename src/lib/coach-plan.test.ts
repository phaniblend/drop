import { describe, expect, it } from "vitest";
import { fallbackKeywordForDay, nextCoachStep, openingMessages } from "./coach-plan";

describe("coach plan", () => {
  it("walks pick → done in order", () => {
    expect(nextCoachStep("pick")).toBe("import");
    expect(nextCoachStep("import")).toBe("clean");
    expect(nextCoachStep("launch")).toBe("done");
    expect(nextCoachStep("done")).toBe("done");
  });

  it("tells the operator the keyword and to share one listing", () => {
    const msgs = openingMessages("car trash can hanging", "Cheap impulse add-on.");
    expect(msgs[1]?.text).toMatch(/car trash can hanging/);
    expect(msgs[2]?.text).toMatch(/Share with Seto/);
  });

  it("picks a stable fallback keyword for a date", () => {
    expect(fallbackKeywordForDay("2026-10-04")).toEqual(fallbackKeywordForDay("2026-10-04"));
  });
});
