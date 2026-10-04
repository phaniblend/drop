/** One daily “do this” for Command. Pure rules — safe for unit tests. */

export type PipelineStage = "STAGING" | "TESTING" | "SCALING" | "CULLING" | "REST";
export type DirectiveAction =
  | "LAUNCH_TEST"
  | "BUMP_BUDGET"
  | "KILL_AND_ROTATE"
  | "PREP_HOOKS"
  | "HOLD_NO_ACTION";

export type DeskSignals = {
  spendToday: number;
  spendFloor: number;
  spendCap: number;
  netBest: number;
  consecutiveProfitDays: number;
  pausedOvernight: boolean;
  pausedName?: string | null;
  capitalSaved?: number;
  stagingCount: number;
  pendingHooks: number;
  testingName?: string | null;
  productTitle?: string | null;
};

export type DeskDirective = {
  stage: PipelineStage;
  headline: string;
  body: string;
  actionType: DirectiveAction;
  actionHref: string;
  actionLabel: string;
};

function moneyish(n: number) {
  return `$${Math.abs(n).toFixed(2)}`;
}

export function pickPipelineStage(input: DeskSignals): PipelineStage {
  if (input.pausedOvernight) return "CULLING";
  if (input.consecutiveProfitDays >= 3 && input.netBest > 25) return "SCALING";
  if (input.spendToday > 0 && input.spendToday < input.spendFloor) return "TESTING";
  if (input.stagingCount <= 1 && input.spendToday <= 0) return "STAGING";
  if (input.spendToday <= 0) return "REST";
  return "TESTING";
}

/** First matching rule wins — operators get exactly one job. */
export function buildDailyDirective(input: DeskSignals): DeskDirective {
  const name = input.pausedName || input.testingName || input.productTitle || "your product";
  const stage = pickPipelineStage(input);

  if (input.pausedOvernight) {
    const saved = input.capitalSaved ?? Math.max(0, input.spendFloor);
    return {
      stage: "CULLING",
      actionType: "KILL_AND_ROTATE",
      headline: "Guard paused a losing ad",
      body: `${name} spent past the safe floor with no profit. About ${moneyish(saved)} stayed in the account. Leave that ad off. Import or publish the next product, then write new ad angles.`,
      actionHref: "/discover",
      actionLabel: "Find the next product",
    };
  }

  if (input.consecutiveProfitDays >= 3 && input.netBest > 25) {
    return {
      stage: "SCALING",
      actionType: "BUMP_BUDGET",
      headline: "This ad is covering cost — raise spend a little",
      body: `${name} made more than $25 net for three days in a row (${moneyish(input.netBest)} today). In Ads Manager, raise the daily budget about 20%. Leave Margin Guard on.`,
      actionHref: "/ads",
      actionLabel: "Open Ads & Guard",
    };
  }

  if (input.spendToday > 0 && input.spendToday < input.spendFloor) {
    return {
      stage: "TESTING",
      actionType: "HOLD_NO_ACTION",
      headline: "Still learning — do not edit the ad today",
      body: `${name} spent ${moneyish(input.spendToday)} of a ${moneyish(input.spendFloor)} floor. Changing the ad now resets learning. Check back tomorrow.`,
      actionHref: "/ads",
      actionLabel: "Preview pause only",
    };
  }

  if (input.stagingCount <= 1) {
    const hooks = Math.max(2, input.pendingHooks || 2);
    return {
      stage: stage === "TESTING" ? "TESTING" : "STAGING",
      actionType: "PREP_HOOKS",
      headline: "Stage the next product before tests finish",
      body: `You have ${input.stagingCount} listing${input.stagingCount === 1 ? "" : "s"} ready behind the live test. Import or write ad angles for ${hooks} backups so you are not stuck when this test ends.`,
      actionHref: input.pendingHooks > 0 ? "/catalog" : "/discover",
      actionLabel: input.pendingHooks > 0 ? "Write ad angles" : "Import a backup product",
    };
  }

  if (input.spendToday <= 0 && (input.productTitle || input.stagingCount > 0)) {
    return {
      stage: "STAGING",
      actionType: "LAUNCH_TEST",
      headline: "Start one small paid test",
      body: `${name} is ready. Launch one ad set with a UTM link from Catalog. Keep spend under your Guard floor until the first sale.`,
      actionHref: "/ads",
      actionLabel: "Open Ads & Guard",
    };
  }

  return {
    stage: "REST",
    actionType: "HOLD_NO_ACTION",
    headline: "No change needed today",
    body: "Nothing is on fire. Fill orders if any are waiting, then leave ads alone.",
    actionHref: "/fulfillment",
    actionLabel: "Open Fulfill",
  };
}

export function stageLabel(stage: PipelineStage) {
  switch (stage) {
    case "STAGING":
      return "Staging";
    case "TESTING":
      return "Testing";
    case "SCALING":
      return "Scaling";
    case "CULLING":
      return "Cut losers";
    default:
      return "Rest";
  }
}
