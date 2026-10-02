import "server-only";

import { and, eq } from "drizzle-orm";
import {
  adPerformanceSnapshots,
  jobRuns,
  metaAdAccounts,
  metaConnections,
  metaEntities,
  storeFinanceConfigs,
} from "../db/schema-guard";
import { decryptSecret } from "../crypto";
import { nid, nowIso, todayKey } from "../utils";
import { resolveMetaToken } from "../integrations/meta-token";
import { env } from "../env";

const META_API = "v26.0";

type Db = Awaited<ReturnType<typeof import("../db").ensureDb>>;

function purchaseFromActions(
  actions: Array<{ action_type?: string; value?: string }> | undefined,
  values: Array<{ action_type?: string; value?: string }> | undefined,
  signal: string,
) {
  const priority =
    signal === "PURCHASE"
      ? ["purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase"]
      : signal === "PIXEL_PURCHASE"
        ? ["offsite_conversion.fb_pixel_purchase", "purchase", "omni_purchase"]
        : ["omni_purchase", "purchase", "offsite_conversion.fb_pixel_purchase"];
  for (const type of priority) {
    const hit = (actions ?? []).find((a) => a.action_type === type);
    if (hit) {
      const val = (values ?? []).find((a) => a.action_type === type);
      return {
        purchases: Number(hit.value ?? 0) || 0,
        purchaseValue: Number(val?.value ?? 0) || 0,
        used: type,
      };
    }
  }
  return { purchases: 0, purchaseValue: 0, used: "none" };
}

async function metaGet(path: string, token: string, params: Record<string, string>) {
  const url = `https://graph.facebook.com/${META_API}/${path}?${new URLSearchParams({
    access_token: token,
    ...params,
  })}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(25_000) });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const err = json.error as { message?: string } | undefined;
    throw new Error(err?.message || `Meta ${res.status}`);
  }
  return json;
}

export async function syncMetaEntitiesForAccount(db: Db, adAccountId: string, token: string) {
  const now = nowIso();
  let synced = 0;
  for (const level of [
    { path: `${adAccountId}/campaigns`, level: "CAMPAIGN" as const, fields: "id,name,status,effective_status" },
    {
      path: `${adAccountId}/adsets`,
      level: "ADSET" as const,
      fields: "id,name,status,effective_status,campaign_id,daily_budget",
    },
    {
      path: `${adAccountId}/ads`,
      level: "AD" as const,
      fields:
        "id,name,status,effective_status,adset_id,campaign_id,creative{url_tags,object_story_spec{link_data{link}}}",
    },
  ]) {
    const json = await metaGet(level.path, token, {
      fields: level.fields,
      limit: "200",
      effective_status: JSON.stringify(["ACTIVE", "PAUSED", "CAMPAIGN_PAUSED"]),
    });
    const data = (json.data as Array<Record<string, unknown>>) ?? [];
    for (const row of data) {
      const id = String(row.id ?? "");
      if (!id) continue;
      const creative = row.creative as
        | { url_tags?: string; object_story_spec?: { link_data?: { link?: string } } }
        | undefined;
      const values = {
        adAccountId,
        level: level.level,
        parentId:
          level.level === "ADSET"
            ? String(row.campaign_id ?? "") || null
            : level.level === "AD"
              ? String(row.adset_id ?? "") || null
              : null,
        name: String(row.name ?? id),
        status: String(row.status ?? ""),
        effectiveStatus: String(row.effective_status ?? row.status ?? ""),
        dailyBudget: row.daily_budget != null ? Number(row.daily_budget) / 100 : null,
        landingUrl: creative?.object_story_spec?.link_data?.link ?? null,
        urlTags: creative?.url_tags ?? null,
        updatedTimeUtc: now,
        syncedAt: now,
      };
      const [have] = await db.select().from(metaEntities).where(eq(metaEntities.id, id)).limit(1);
      if (have) {
        await db.update(metaEntities).set(values).where(eq(metaEntities.id, id));
      } else {
        await db.insert(metaEntities).values({
          id,
          ...values,
          createdTimeUtc: now,
        });
      }
      synced += 1;
    }
  }
  return synced;
}

export async function syncMetaInsightsForAccount(
  db: Db,
  adAccountId: string,
  token: string,
  opts: { windowDays?: number; purchaseSignal?: string; timezoneName?: string } = {},
) {
  const windowDays = opts.windowDays ?? 3;
  const tz = opts.timezoneName || "UTC";
  const end = todayKey(tz);
  const startDate = new Date();
  startDate.setUTCDate(startDate.getUTCDate() - (windowDays - 1));
  const start = todayKey(tz, startDate);
  const json = await metaGet(`${adAccountId}/insights`, token, {
    level: "adset",
    fields:
      "adset_id,campaign_id,spend,impressions,inline_link_clicks,actions,action_values,account_currency,date_start,date_stop",
    time_range: JSON.stringify({ since: start, until: end }),
    filtering: JSON.stringify([{ field: "adset.effective_status", operator: "IN", value: ["ACTIVE"] }]),
    action_attribution_windows: JSON.stringify(["7d_click", "1d_view"]),
    limit: "500",
  });
  const data = (json.data as Array<Record<string, unknown>>) ?? [];
  const now = nowIso();
  let written = 0;
  for (const row of data) {
    const entityId = String(row.adset_id ?? "");
    if (!entityId) continue;
    const actions = row.actions as Array<{ action_type?: string; value?: string }> | undefined;
    const actionValues = row.action_values as Array<{ action_type?: string; value?: string }> | undefined;
    const purchase = purchaseFromActions(actions, actionValues, opts.purchaseSignal || "OMNI_PURCHASE");
    const addToCart = (actions ?? [])
      .filter((a) => /add_to_cart/i.test(a.action_type ?? ""))
      .reduce((s, a) => s + (Number(a.value ?? 0) || 0), 0);
    await db.insert(adPerformanceSnapshots).values({
      id: nid("snap"),
      adAccountId,
      level: "ADSET",
      entityId,
      snapshotAtUtc: now,
      windowStartLocal: start,
      windowEndLocal: end,
      attributionSetting: "7d_click,1d_view",
      accountCurrency: String(row.account_currency ?? "USD"),
      fxToShopCurrency: 1,
      spend: Number(row.spend ?? 0) || 0,
      impressions: Number(row.impressions ?? 0) || 0,
      inlineLinkClicks: Number(row.inline_link_clicks ?? 0) || 0,
      addToCart: Math.round(addToCart),
      purchases: Math.round(purchase.purchases),
      purchaseValue: purchase.purchaseValue,
      firstSpendAtUtc: Number(row.spend ?? 0) > 0 ? now : null,
      rawJson: JSON.stringify({ purchaseSignal: purchase.used, row }),
    });
    written += 1;
  }
  await db
    .update(metaAdAccounts)
    .set({ lastInsightsSyncAt: now, updatedAt: now })
    .where(eq(metaAdAccounts.id, adAccountId));
  return written;
}

export async function runMetaSyncJobs(db: Db) {
  const accounts = await db
    .select({
      id: metaAdAccounts.id,
      timezoneName: metaAdAccounts.timezoneName,
      metaConnectionId: metaAdAccounts.metaConnectionId,
      storeId: metaConnections.storeId,
      accessTokenEnc: metaConnections.accessTokenEnc,
      status: metaConnections.status,
    })
    .from(metaAdAccounts)
    .innerJoin(metaConnections, eq(metaAdAccounts.metaConnectionId, metaConnections.id))
    .where(and(eq(metaConnections.status, "ACTIVE")));

  const results: Array<{ adAccountId: string; entities: number; insights: number; error?: string }> = [];

  if (!accounts.length) {
    // Fall back to env token + META_AD_ACCOUNT_ID for single-tenant desks.
    const token = await resolveMetaToken();
    const act = env.metaAdAccountId?.startsWith("act_")
      ? env.metaAdAccountId
      : env.metaAdAccountId
        ? `act_${env.metaAdAccountId}`
        : "";
    if (token && act) {
      try {
        const entities = await syncMetaEntitiesForAccount(db, act, token);
        const insights = await syncMetaInsightsForAccount(db, act, token);
        results.push({ adAccountId: act, entities, insights });
      } catch (e) {
        results.push({
          adAccountId: act,
          entities: 0,
          insights: 0,
          error: e instanceof Error ? e.message : "sync failed",
        });
      }
    }
    return results;
  }

  for (const acct of accounts) {
    const jobId = nid("job");
    await db.insert(jobRuns).values({
      id: jobId,
      job: "meta.insights",
      scopeKey: acct.id,
      startedAt: nowIso(),
    });
    try {
      let token = "";
      try {
        token = decryptSecret(acct.accessTokenEnc);
      } catch {
        token = acct.accessTokenEnc;
      }
      const [finance] = await db
        .select()
        .from(storeFinanceConfigs)
        .where(eq(storeFinanceConfigs.storeId, acct.storeId))
        .limit(1);
      const entities = await syncMetaEntitiesForAccount(db, acct.id, token);
      const insights = await syncMetaInsightsForAccount(db, acct.id, token, {
        windowDays: finance?.evaluationWindowDays ?? 3,
        purchaseSignal: finance?.purchaseSignal ?? "OMNI_PURCHASE",
        timezoneName: acct.timezoneName,
      });
      await db
        .update(jobRuns)
        .set({
          finishedAt: nowIso(),
          ok: true,
          statsJson: JSON.stringify({ entities, insights }),
        })
        .where(eq(jobRuns.id, jobId));
      results.push({ adAccountId: acct.id, entities, insights });
    } catch (e) {
      await db
        .update(jobRuns)
        .set({
          finishedAt: nowIso(),
          ok: false,
          error: e instanceof Error ? e.message : "sync failed",
        })
        .where(eq(jobRuns.id, jobId));
      results.push({
        adAccountId: acct.id,
        entities: 0,
        insights: 0,
        error: e instanceof Error ? e.message : "sync failed",
      });
    }
  }
  return results;
}
