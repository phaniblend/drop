import { describe, expect, it } from "vitest";
import { buildDailyDirective, pickPipelineStage } from "./operator-desk";

describe("operator desk directive", () => {
  it("picks kill-and-rotate when Guard paused overnight", () => {
    const d = buildDailyDirective({
      spendToday: 40,
      spendFloor: 35,
      spendCap: 500,
      netBest: -12,
      consecutiveProfitDays: 0,
      pausedOvernight: true,
      pausedName: "Posture Brace",
      capitalSaved: 40,
      stagingCount: 2,
      pendingHooks: 0,
    });
    expect(d.actionType).toBe("KILL_AND_ROTATE");
    expect(d.stage).toBe("CULLING");
    expect(d.headline).toMatch(/paused/i);
  });

  it("bumps budget after three profitable days", () => {
    const d = buildDailyDirective({
      spendToday: 40,
      spendFloor: 35,
      spendCap: 500,
      netBest: 28,
      consecutiveProfitDays: 3,
      pausedOvernight: false,
      testingName: "Posture Brace",
      stagingCount: 3,
      pendingHooks: 0,
    });
    expect(d.actionType).toBe("BUMP_BUDGET");
    expect(d.stage).toBe("SCALING");
  });

  it("holds while spend is under the floor", () => {
    const d = buildDailyDirective({
      spendToday: 18.5,
      spendFloor: 35,
      spendCap: 500,
      netBest: 6,
      consecutiveProfitDays: 0,
      pausedOvernight: false,
      testingName: "Posture Brace",
      stagingCount: 3,
      pendingHooks: 0,
    });
    expect(d.actionType).toBe("HOLD_NO_ACTION");
    expect(d.headline).toMatch(/learning/i);
  });

  it("asks for backup products when the pipeline is thin", () => {
    const d = buildDailyDirective({
      spendToday: 40,
      spendFloor: 35,
      spendCap: 500,
      netBest: 4,
      consecutiveProfitDays: 1,
      pausedOvernight: false,
      stagingCount: 1,
      pendingHooks: 2,
    });
    expect(d.actionType).toBe("PREP_HOOKS");
  });

  it("maps pause to CULLING stage", () => {
    expect(
      pickPipelineStage({
        spendToday: 10,
        spendFloor: 35,
        spendCap: 500,
        netBest: 0,
        consecutiveProfitDays: 0,
        pausedOvernight: true,
        stagingCount: 0,
        pendingHooks: 0,
      }),
    ).toBe("CULLING");
  });
});
