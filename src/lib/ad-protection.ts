export const DEFAULT_SENTINEL = {
  enabled: true,
  hookSpend: 5,
  minCtr: 1.5,
  maxCpc: 1.8,
  intentSpend: 15,
};

export type SentinelSettings = typeof DEFAULT_SENTINEL;

export type PauseSource = "manual" | "margin_guard" | "sentinel" | "dayparting";

export type SentinelKill = "POOR_HOOK_CTR" | "ZERO_CART_INTENT";

export type AdTelemetry = {
  spend: number;
  impressions: number;
  clicks: number;
  addToCartCount: number;
};

export function parseSentinelSettings(raw: string | null | undefined): SentinelSettings {
  try {
    const parsed = JSON.parse(raw || "{}") as Partial<SentinelSettings>;
    return {
      enabled: parsed.enabled !== false,
      hookSpend: Number.isFinite(Number(parsed.hookSpend)) ? Number(parsed.hookSpend) : DEFAULT_SENTINEL.hookSpend,
      minCtr: Number.isFinite(Number(parsed.minCtr)) ? Number(parsed.minCtr) : DEFAULT_SENTINEL.minCtr,
      maxCpc: Number.isFinite(Number(parsed.maxCpc)) ? Number(parsed.maxCpc) : DEFAULT_SENTINEL.maxCpc,
      intentSpend: Number.isFinite(Number(parsed.intentSpend))
        ? Number(parsed.intentSpend)
        : DEFAULT_SENTINEL.intentSpend,
    };
  } catch {
    return { ...DEFAULT_SENTINEL };
  }
}

export function telemetryRates(tel: AdTelemetry) {
  const ctr = tel.impressions > 0 ? (tel.clicks / tel.impressions) * 100 : 0;
  const cpc = tel.clicks > 0 ? tel.spend / tel.clicks : tel.spend > 0 ? tel.spend : 0;
  return { ctr, cpc };
}

export function evaluateSentinel(tel: AdTelemetry, settings: SentinelSettings): SentinelKill | null {
  if (!settings.enabled) return null;
  const { ctr, cpc } = telemetryRates(tel);
  if (tel.spend >= settings.hookSpend && (ctr < settings.minCtr || cpc > settings.maxCpc)) {
    return "POOR_HOOK_CTR";
  }
  if (tel.spend >= settings.intentSpend && tel.addToCartCount === 0) {
    return "ZERO_CART_INTENT";
  }
  return null;
}

export const ORGANIC_VIEW_FLOOR = 1000;

export function parseOrganicViews(raw: string | null | undefined): [number, number, number] {
  try {
    const parsed = JSON.parse(raw || "[0,0,0]") as unknown;
    if (!Array.isArray(parsed)) return [0, 0, 0];
    return [0, 1, 2].map((i) => Math.max(0, Math.round(Number(parsed[i]) || 0))) as [number, number, number];
  } catch {
    return [0, 0, 0];
  }
}

export function isPaidLaunchUnlocked(input: {
  organicStatus?: string | null;
  organicViewsJson?: string | null;
}) {
  if (input.organicStatus === "passed" || input.organicStatus === "overridden") return true;
  return parseOrganicViews(input.organicViewsJson).every((n) => n >= ORGANIC_VIEW_FLOOR);
}

export function explainGuardDecision(input: {
  actionTaken: string;
  pauseReason?: string | null;
  liveCall?: boolean;
  pausedLive?: boolean;
  dryRun?: boolean;
  currentSpend: number;
  spendThreshold: number;
  netProfit: number;
  roas: number;
}) {
  const spend = input.currentSpend.toFixed(2);
  const floor = input.spendThreshold.toFixed(2);
  const net = input.netProfit.toFixed(2);
  const where = input.dryRun
    ? "Preview only — no ad was paused."
    : input.pausedLive
      ? "The live ad set was paused."
      : input.liveCall
        ? "The live ad stayed on."
        : "Ads are not connected, so this stayed in the desk only.";
  const lead = input.dryRun ? "Would pause" : "Paused";
  if (input.actionTaken === "POOR_HOOK_CTR") {
    return `${lead}: spend reached $${spend} and the first clicks look too expensive or too few. ${where}`;
  }
  if (input.actionTaken === "ZERO_CART_INTENT") {
    return `${lead}: spend reached $${spend} and nobody added to cart. ${where}`;
  }
  if (input.actionTaken === "KILLED_CAMPAIGN") {
    return `${lead}: spend reached the $${floor} pause-after amount and the ad is not paying back (net $${net}, ${input.roas.toFixed(2)}x). ${where}`;
  }
  return `Keep running. Spend $${spend} of $${floor} pause-after. Net $${net}. ${where}`;
}

export function organicUnlockState(input: {
  organicStatus?: string | null;
  organicViewsJson?: string | null;
}) {
  const views = parseOrganicViews(input.organicViewsJson);
  const passedViews = views.every((n) => n >= ORGANIC_VIEW_FLOOR);
  const unlocked = isPaidLaunchUnlocked(input);
  return { views, passedViews, unlocked, status: unlocked ? (input.organicStatus === "overridden" ? "overridden" : "passed") : "pending" };
}
