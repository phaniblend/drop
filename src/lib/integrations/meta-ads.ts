import "server-only";

import { eq } from "drizzle-orm";
import { env } from "../env";
import { ensureDb } from "../db";
import { campaignTrackers, users } from "../db/schema";
import { nid, nowIso } from "../utils";

const META_API_VERSION = "v26.0";

export type MetaAdSetRow = {
  id: string;
  name: string;
  status: string;
  campaignId: string;
  dailyBudget?: number;
};

export type MetaAdSetsFetch = {
  ok: boolean;
  adAccountId: string;
  adSets: MetaAdSetRow[];
  error: string | null;
};

function normalizeAdAccountId(raw: string) {
  const id = raw.trim();
  if (!id) return "";
  return id.startsWith("act_") ? id : `act_${id}`;
}

export async function fetchMetaAdSets(accessToken: string, adAccountId: string): Promise<MetaAdSetsFetch> {
  const act = normalizeAdAccountId(adAccountId);
  if (!act) {
    return {
      ok: false,
      adAccountId: "",
      adSets: [],
      error: "META_AD_ACCOUNT_ID is missing. Add it on Railway (act_… or numeric id).",
    };
  }
  if (!accessToken) {
    return { ok: false, adAccountId: act, adSets: [], error: "Meta access token is missing or expired." };
  }

  const url = `https://graph.facebook.com/${META_API_VERSION}/${act}/adsets?${new URLSearchParams({
    access_token: accessToken,
    fields: "id,name,status,campaign_id,daily_budget",
    limit: "50",
    effective_status: JSON.stringify(["ACTIVE", "PAUSED", "CAMPAIGN_PAUSED"]),
  })}`;

  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "network error";
    return { ok: false, adAccountId: act, adSets: [], error: `Meta network: ${msg}` };
  }

  const raw = await res.text();
  let json: {
    data?: Array<{
      id?: string;
      name?: string;
      status?: string;
      campaign_id?: string;
      daily_budget?: string;
    }>;
    error?: { message?: string; code?: number; type?: string };
  };
  try {
    json = JSON.parse(raw) as typeof json;
  } catch {
    return {
      ok: false,
      adAccountId: act,
      adSets: [],
      error: `Meta HTTP ${res.status}: non-JSON body`,
    };
  }

  if (!res.ok || json.error) {
    const msg =
      json.error?.message ||
      `Meta HTTP ${res.status}${json.error?.type ? ` (${json.error.type})` : ""}`;
    return { ok: false, adAccountId: act, adSets: [], error: msg };
  }

  const adSets: MetaAdSetRow[] = (json.data ?? [])
    .filter((row) => row.id)
    .map((row) => ({
      id: String(row.id),
      name: row.name || row.id || "Ad set",
      status: row.status || "UNKNOWN",
      campaignId: String(row.campaign_id || ""),
      dailyBudget: row.daily_budget ? Number(row.daily_budget) / 100 : undefined,
    }));

  return { ok: true, adAccountId: act, adSets, error: null };
}

/** Upsert Meta ad sets into campaign_trackers so Ads & Guard has cards to show. */
export async function syncMetaAdSetsIntoTrackers(): Promise<MetaAdSetsFetch & { synced: number }> {
  const { resolveMetaToken } = await import("./meta-token");
  const token = await resolveMetaToken();
  const accountId = env.metaAdAccountId;
  const fetched = await fetchMetaAdSets(token, accountId);
  if (!fetched.ok) return { ...fetched, synced: 0 };

  const db = await ensureDb();
  const [operator] = await db.select().from(users).limit(1);
  const spendLimit = operator?.spendLimitThreshold ?? 50;
  const minRoas = operator?.minRoasThreshold ?? 1.2;
  const existing = await db.select().from(campaignTrackers);
  const byAdSet = new Map(existing.filter((r) => r.platform === "meta").map((r) => [r.adSetId, r]));

  let synced = 0;
  for (const adSet of fetched.adSets) {
    const hit = byAdSet.get(adSet.id);
    if (hit) {
      await db
        .update(campaignTrackers)
        .set({
          adSetName: adSet.name,
          campaignId: adSet.campaignId || hit.campaignId,
          adAccountId: fetched.adAccountId,
          isPaused: /PAUSE/i.test(adSet.status) ? true : hit.isPaused,
          lastPolledAt: nowIso(),
        })
        .where(eq(campaignTrackers.id, hit.id));
      synced += 1;
      continue;
    }
    await db.insert(campaignTrackers).values({
      id: nid("trk"),
      productId: null,
      platform: "meta",
      adAccountId: fetched.adAccountId,
      campaignId: adSet.campaignId || adSet.id,
      adSetId: adSet.id,
      adSetName: adSet.name,
      spendLimitThreshold: spendLimit,
      minRoasThreshold: minRoas,
      spendToday: 0,
      revenueToday: 0,
      ordersCount: 0,
      isPaused: /PAUSE/i.test(adSet.status),
      impressions: 0,
      clicks: 0,
      addToCartCount: 0,
      pauseReason: /PAUSE/i.test(adSet.status) ? "META_STATUS" : null,
      pauseSource: /PAUSE/i.test(adSet.status) ? "manual" : null,
      lastPolledAt: nowIso(),
    });
    synced += 1;
  }

  return { ...fetched, synced };
}
