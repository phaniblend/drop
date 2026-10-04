import { describe, expect, it } from "vitest";
import { evaluateShare, fallbackKeywordForDay, instructionFor, nextCoachStep, openingMessages } from "./coach-plan";

describe("coach plan", () => {
  it("walks the full pipeline and pauses on done", () => {
    expect(nextCoachStep("pick")).toBe("import");
    expect(nextCoachStep("import")).toBe("publish");
    expect(nextCoachStep("publish")).toBe("ads");
    expect(nextCoachStep("ads")).toBe("sale");
    expect(nextCoachStep("sale")).toBe("kill");
    expect(nextCoachStep("kill")).toBe("done");
    expect(nextCoachStep("done")).toBe("done");
  });

  it("pauses until evidence exists on later steps", () => {
    const empty = {
      imported: false,
      published: false,
      adLinked: false,
      adPausedLoser: false,
      adWinning: false,
      hasCheckout: false,
      orderPlaced: false,
    };
    expect(evaluateShare("import", empty).ok).toBe(false);
    expect(evaluateShare("publish", { ...empty, imported: true }).ok).toBe(false);
    expect(evaluateShare("ads", { ...empty, imported: true, published: true }).ok).toBe(false);
    expect(evaluateShare("sale", { ...empty, adLinked: true }).ok).toBe(false);
    expect(evaluateShare("kill", { ...empty, adLinked: true }).ok).toBe(false);
    expect(evaluateShare("import", { ...empty, imported: true }).ok).toBe(true);
    expect(evaluateShare("kill", { ...empty, adPausedLoser: true }).ok).toBe(true);
    expect(evaluateShare("kill", { ...empty, adWinning: true }).ok).toBe(true);
  });

  it("every live instruction says it will wait", () => {
    for (const step of ["pick", "import", "publish", "ads", "sale", "kill"] as const) {
      expect(instructionFor(step, { keyword: "car trash can hanging", title: "Can" })).toMatch(/I’ll wait/);
    }
  });

  it("opening plan names the pipeline and the keyword", () => {
    const msgs = openingMessages("car trash can hanging", "Cheap impulse add-on.");
    expect(msgs[0]?.text).toMatch(/kill losers/);
    expect(msgs[1]?.text).toMatch(/car trash can hanging/);
    expect(msgs[1]?.text).toMatch(/I’ll wait/);
  });

  it("picks a stable fallback keyword for a date", () => {
    expect(fallbackKeywordForDay("2026-10-04")).toEqual(fallbackKeywordForDay("2026-10-04"));
  });
});
