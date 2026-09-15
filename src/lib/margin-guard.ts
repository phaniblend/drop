import "server-only";

import { env, integrationStatus } from "./env";
import { netProfit } from "./money";

const META_API_VERSION = "v26.0";

export async function getHourlyAdSpend(adSetId: string, accessToken: string) {
  const response = await fetch(
    `https://graph.facebook.com/${META_API_VERSION}/${adSetId}/insights?${new URLSearchParams({
      access_token: accessToken,
      fields: "spend",
      date_preset: "today",
    })}`,
  );
  if (!response.ok) {
    throw new Error(`Meta insights ${response.status}: ${await response.text()}`);
  }
  const json = (await response.json()) as { data?: Array<{ spend?: string }> };
  const data = json.data;
  return data && data.length > 0 ? parseFloat(data[0].spend || "0") : 0;
}

export async function pauseAdSet(adSetId: string, accessToken: string) {
  const response = await fetch(
    `https://graph.facebook.com/${META_API_VERSION}/${adSetId}?${new URLSearchParams({
      access_token: accessToken,
    })}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "PAUSED" }),
    },
  );
  if (!response.ok) {
    throw new Error(`Meta pause failed: ${await response.text()}`);
  }
  const json = (await response.json()) as { success?: boolean };
  return json.success === true;
}

export async function getTikTokAdGroupSpend(adGroupId: string, accessToken: string) {
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
      metrics: ["spend", "complete_payment_roas"],
      start_date: new Date().toISOString().slice(0, 10),
      end_date: new Date().toISOString().slice(0, 10),
      filters: [{ field_name: "adgroup_id", filter_type: "IN", filter_value: [adGroupId] }],
    }),
  });
  if (!res.ok) throw new Error(`TikTok report ${res.status}`);
  const json = (await res.json()) as {
    data?: { list?: Array<{ metrics?: { spend?: string } }> };
  };
  return parseFloat(json.data?.list?.[0]?.metrics?.spend || "0");
}

export async function pauseTikTokAdGroup(adGroupId: string, accessToken: string) {
  const res = await fetch("https://business-api.tiktok.com/open_api/v1.3/adgroup/status/update/", {
    method: "POST",
    headers: {
      "Access-Token": accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      advertiser_id: env.tiktokAdvertiserId,
      adgroup_ids: [adGroupId],
      operation_status: "DISABLE",
    }),
  });
  if (!res.ok) throw new Error(`TikTok pause failed: ${await res.text()}`);
  return true;
}

export async function runSafetyCircuitCheck(input: {
  adSetId: string;
  platform: "meta" | "tiktok";
  attributedRevenue: number;
  totalCogs: number;
  spendThreshold?: number;
  minRoas?: number;
  currentSpend?: number;
}) {
  const spendThreshold = input.spendThreshold ?? 50;
  const live = integrationStatus();
  let currentSpend = input.currentSpend ?? 0;
  let liveCall = false;

  if (input.platform === "meta" && live.meta && env.metaToken) {
    currentSpend = await getHourlyAdSpend(input.adSetId, env.metaToken);
    liveCall = true;
  }
  if (input.platform === "tiktok" && live.tiktok && env.tiktokToken) {
    currentSpend = await getTikTokAdGroupSpend(input.adSetId, env.tiktokToken);
    liveCall = true;
  }

  const profit = netProfit({
    revenue: input.attributedRevenue,
    cogs: input.totalCogs,
    adSpend: currentSpend,
  });
  const roas = currentSpend > 0 ? input.attributedRevenue / currentSpend : 0;
  const shouldKill =
    currentSpend >= spendThreshold && (profit < 0 || (input.minRoas ? roas < input.minRoas : false));

  let pausedLive = false;
  if (shouldKill && liveCall) {
    if (input.platform === "meta" && env.metaToken) {
      pausedLive = await pauseAdSet(input.adSetId, env.metaToken);
    }
    if (input.platform === "tiktok" && env.tiktokToken) {
      pausedLive = await pauseTikTokAdGroup(input.adSetId, env.tiktokToken);
    }
  }

  return {
    actionTaken: shouldKill ? "KILLED_CAMPAIGN" : "MAINTAINED",
    netProfit: profit,
    currentSpend,
    roas,
    liveCall,
    pausedLive,
  };
}
