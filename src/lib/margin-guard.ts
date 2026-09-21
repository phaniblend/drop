import "server-only";

import { env, integrationStatus } from "./env";
import { netProfit } from "./money";
import {
  evaluateSentinel,
  parseSentinelSettings,
  telemetryRates,
  type AdTelemetry,
  type PauseSource,
  type SentinelSettings,
} from "./ad-protection";

const META_API_VERSION = "v26.0";

export async function getHourlyAdSpend(adSetId: string, accessToken: string) {
  const insights = await getMetaAdSetInsights(adSetId, accessToken);
  return insights.spend;
}

export async function getMetaAdSetInsights(adSetId: string, accessToken: string): Promise<AdTelemetry> {
  const response = await fetch(
    `https://graph.facebook.com/${META_API_VERSION}/${adSetId}/insights?${new URLSearchParams({
      access_token: accessToken,
      fields: "spend,impressions,clicks,ctr,cpc,actions",
      date_preset: "today",
    })}`,
  );
  if (!response.ok) {
    throw new Error(`Meta insights ${response.status}: ${await response.text()}`);
  }
  const json = (await response.json()) as {
    data?: Array<{
      spend?: string;
      impressions?: string;
      clicks?: string;
      actions?: Array<{ action_type?: string; value?: string }>;
    }>;
  };
  const row = json.data?.[0];
  const addToCart = (row?.actions ?? [])
    .filter((a) => /add_to_cart|add-to-cart/i.test(a.action_type ?? ""))
    .reduce((s, a) => s + Number(a.value ?? 0), 0);
  return {
    spend: parseFloat(row?.spend || "0") || 0,
    impressions: parseFloat(row?.impressions || "0") || 0,
    clicks: parseFloat(row?.clicks || "0") || 0,
    addToCartCount: Math.round(addToCart),
  };
}

export async function pauseAdSet(adSetId: string, accessToken: string) {
  return setMetaAdSetStatus(adSetId, accessToken, "PAUSED");
}

export async function activateAdSet(adSetId: string, accessToken: string) {
  return setMetaAdSetStatus(adSetId, accessToken, "ACTIVE");
}

async function setMetaAdSetStatus(adSetId: string, accessToken: string, status: "PAUSED" | "ACTIVE") {
  const response = await fetch(
    `https://graph.facebook.com/${META_API_VERSION}/${adSetId}?${new URLSearchParams({
      access_token: accessToken,
    })}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    },
  );
  if (!response.ok) {
    throw new Error(`Meta ${status.toLowerCase()} failed: ${await response.text()}`);
  }
  const json = (await response.json()) as { success?: boolean };
  return json.success === true;
}

export async function getTikTokAdGroupSpend(adGroupId: string, accessToken: string) {
  const insights = await getTikTokAdGroupInsights(adGroupId, accessToken);
  return insights.spend;
}

export async function getTikTokAdGroupInsights(adGroupId: string, accessToken: string): Promise<AdTelemetry> {
  const res = await fetch("https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/", {
    method: "POST",
    headers: {
      "Access-Token": accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      advertiser_id: env.tiktokAdvertiserId,
      report_type: "BASIC",
      dimensions: ["adgroup_id"],
      data_level: "AUCTION_ADGROUP",
      metrics: ["spend", "clicks", "impressions", "conversion"],
      start_date: new Date().toISOString().slice(0, 10),
      end_date: new Date().toISOString().slice(0, 10),
      filters: [{ field_name: "adgroup_id", filter_type: "IN", filter_value: [adGroupId] }],
    }),
  });
  if (!res.ok) throw new Error(`TikTok report ${res.status}`);
  const json = (await res.json()) as {
    data?: { list?: Array<{ metrics?: Record<string, string> }> };
  };
  const metrics = json.data?.list?.[0]?.metrics ?? {};
  return {
    spend: parseFloat(metrics.spend || "0") || 0,
    impressions: parseFloat(metrics.impressions || "0") || 0,
    clicks: parseFloat(metrics.clicks || "0") || 0,
    addToCartCount: Math.round(parseFloat(metrics.conversion || "0") || 0),
  };
}

export async function pauseTikTokAdGroup(adGroupId: string, accessToken: string) {
  return setTikTokAdGroupStatus(adGroupId, accessToken, "DISABLE");
}

export async function resumeTikTokAdGroup(adGroupId: string, accessToken: string) {
  return setTikTokAdGroupStatus(adGroupId, accessToken, "ENABLE");
}

async function setTikTokAdGroupStatus(adGroupId: string, accessToken: string, operation_status: "DISABLE" | "ENABLE") {
  const res = await fetch("https://business-api.tiktok.com/open_api/v1.3/adgroup/status/update/", {
    method: "POST",
    headers: {
      "Access-Token": accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      advertiser_id: env.tiktokAdvertiserId,
      adgroup_ids: [adGroupId],
      operation_status,
    }),
  });
  if (!res.ok) throw new Error(`TikTok status update failed: ${await res.text()}`);
  return true;
}

export type GuardAction = "MAINTAINED" | "KILLED_CAMPAIGN" | "POOR_HOOK_CTR" | "ZERO_CART_INTENT";

export async function runSafetyCircuitCheck(input: {
  adSetId: string;
  platform: "meta" | "tiktok";
  attributedRevenue: number;
  totalCogs: number;
  spendThreshold?: number;
  minRoas?: number;
  currentSpend?: number;
  impressions?: number;
  clicks?: number;
  addToCartCount?: number;
  sentinel?: SentinelSettings | string | null;
  dryRun?: boolean;
}) {
  const spendThreshold = input.spendThreshold ?? 50;
  const live = integrationStatus();
  let telemetry: AdTelemetry = {
    spend: input.currentSpend ?? 0,
    impressions: input.impressions ?? 0,
    clicks: input.clicks ?? 0,
    addToCartCount: input.addToCartCount ?? 0,
  };
  let liveCall = false;

  if (input.platform === "meta" && live.meta && env.metaToken) {
    telemetry = await getMetaAdSetInsights(input.adSetId, env.metaToken);
    liveCall = true;
  }
  if (input.platform === "tiktok" && live.tiktok && env.tiktokToken) {
    telemetry = await getTikTokAdGroupInsights(input.adSetId, env.tiktokToken);
    liveCall = true;
  }

  const sentinel = parseSentinelSettings(
    typeof input.sentinel === "string" || input.sentinel == null
      ? input.sentinel
      : JSON.stringify(input.sentinel),
  );
  const sentinelKill = evaluateSentinel(telemetry, sentinel);

  const profit = netProfit({
    revenue: input.attributedRevenue,
    cogs: input.totalCogs,
    adSpend: telemetry.spend,
  });
  const roas = telemetry.spend > 0 ? input.attributedRevenue / telemetry.spend : 0;
  const marginKill =
    telemetry.spend >= spendThreshold && (profit < 0 || (input.minRoas ? roas < input.minRoas : false));

  let actionTaken: GuardAction = "MAINTAINED";
  let pauseSource: PauseSource | null = null;
  if (sentinelKill) {
    actionTaken = sentinelKill;
    pauseSource = "sentinel";
  } else if (marginKill) {
    actionTaken = "KILLED_CAMPAIGN";
    pauseSource = "margin_guard";
  }

  const shouldKill = actionTaken !== "MAINTAINED" && !input.dryRun;
  let pausedLive = false;
  if (shouldKill && liveCall) {
    if (input.platform === "meta" && env.metaToken) {
      pausedLive = await pauseAdSet(input.adSetId, env.metaToken);
    }
    if (input.platform === "tiktok" && env.tiktokToken) {
      pausedLive = await pauseTikTokAdGroup(input.adSetId, env.tiktokToken);
    }
  }

  const { ctr, cpc } = telemetryRates(telemetry);
  return {
    actionTaken,
    pauseSource,
    pauseReason: sentinelKill ?? (marginKill ? "MARGIN_GUARD" : null),
    netProfit: profit,
    currentSpend: telemetry.spend,
    impressions: telemetry.impressions,
    clicks: telemetry.clicks,
    addToCartCount: telemetry.addToCartCount,
    ctr,
    cpc,
    roas,
    liveCall,
    pausedLive,
  };
}
