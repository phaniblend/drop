"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { ensureDb } from "@/lib/db";
import { getOperator, listCampaigns } from "@/lib/db/queries";
import { campaignTrackers, products, users } from "@/lib/db/schema";
import { logActivity } from "@/lib/db/seed";
import { runSafetyCircuitCheck } from "@/lib/margin-guard";
import { assertCampaignUnpause, isBillingError } from "@/lib/billing";
import {
  DEFAULT_SENTINEL,
  explainGuardDecision,
  isPaidLaunchUnlocked,
  parseSentinelSettings,
  type SentinelSettings,
} from "@/lib/ad-protection";
import { runDaypartingTick } from "@/lib/dayparting";

export async function runCampaignGuard(campaignId: string) {
  const [campaigns, operator] = await Promise.all([listCampaigns(), getOperator()]);
  const campaign = campaigns.find((c) => c.id === campaignId);
  if (!campaign) throw new Error("Campaign not found.");

  const result = await runSafetyCircuitCheck({
    adSetId: campaign.adSetId,
    platform: campaign.platform === "tiktok" ? "tiktok" : "meta",
    attributedRevenue: campaign.revenueToday,
    totalCogs: campaign.cogsToday,
    spendThreshold: campaign.spendLimitThreshold,
    minRoas: campaign.minRoasThreshold,
    currentSpend: campaign.spendToday,
    impressions: campaign.impressions ?? 0,
    clicks: campaign.clicks ?? 0,
    addToCartCount: campaign.addToCartCount ?? 0,
    sentinel: operator?.sentinelSettings,
  });

  const db = await ensureDb();
  const killed = result.actionTaken !== "MAINTAINED";
  const nextSource = killed
    ? result.pauseSource
    : campaign.pauseSource === "dayparting"
      ? "dayparting"
      : campaign.pauseSource;
  const nextReason = killed
    ? result.pauseReason
    : campaign.pauseSource === "dayparting"
      ? campaign.pauseReason
      : campaign.pauseReason;

  await db
    .update(campaignTrackers)
    .set({
      isPaused: killed ? true : campaign.isPaused,
      pauseReason: nextReason,
      pauseSource: nextSource,
      spendToday: result.currentSpend,
      impressions: result.impressions,
      clicks: result.clicks,
      addToCartCount: result.addToCartCount,
      lastPolledAt: new Date().toISOString(),
    })
    .where(eq(campaignTrackers.id, campaignId));

  const explanation = explainGuardDecision({
    ...result,
    spendThreshold: campaign.spendLimitThreshold,
    dryRun: false,
  });
  await logActivity(db, {
    kind: killed ? "alert" : "ads",
    message: `${explanation} (${campaign.adSetName})`,
    href: "/ads",
  });

  revalidatePath("/ads");
  revalidatePath("/");
  return { ...result, explanation };
}

export async function previewCampaignGuard(campaignId: string) {
  const [campaigns, operator] = await Promise.all([listCampaigns(), getOperator()]);
  const campaign = campaigns.find((c) => c.id === campaignId);
  if (!campaign) throw new Error("Campaign not found.");
  const result = await runSafetyCircuitCheck({
    adSetId: campaign.adSetId,
    platform: campaign.platform === "tiktok" ? "tiktok" : "meta",
    attributedRevenue: campaign.revenueToday,
    totalCogs: campaign.cogsToday,
    spendThreshold: campaign.spendLimitThreshold,
    minRoas: campaign.minRoasThreshold,
    currentSpend: campaign.spendToday,
    impressions: campaign.impressions ?? 0,
    clicks: campaign.clicks ?? 0,
    addToCartCount: campaign.addToCartCount ?? 0,
    sentinel: operator?.sentinelSettings,
    dryRun: true,
  });
  return {
    ...result,
    explanation: explainGuardDecision({
      ...result,
      spendThreshold: campaign.spendLimitThreshold,
      dryRun: true,
    }),
  };
}

export async function runAllGuards() {
  const operator = await getOperator();
  const daypart = await runDaypartingTick({
    enabled: Boolean(operator?.daypartingEnabled),
    timeZone: operator?.timezone || "America/Chicago",
  });
  const campaigns = await listCampaigns();
  const results = [];
  for (const c of campaigns) {
    results.push(await runCampaignGuard(c.id));
  }
  return { daypart, results };
}

export async function togglePause(campaignId: string, paused: boolean) {
  const db = await ensureDb();
  const [row] = await db.select().from(campaignTrackers).where(eq(campaignTrackers.id, campaignId)).limit(1);
  if (!row) throw new Error("Campaign not found.");

  if (!paused) {
    if (row.productId) {
      const [product] = await db.select().from(products).where(eq(products.id, row.productId)).limit(1);
      if (product && !isPaidLaunchUnlocked(product)) {
        return {
          error:
            "Paid launch is locked until the 3-video organic test passes (1,000+ views each) or you override it in Daily ops.",
        };
      }
    }
    if (row.isPaused) {
      try {
        await assertCampaignUnpause();
      } catch (error) {
        if (isBillingError(error)) return { paywall: error.paywall };
        throw error;
      }
    }
  }

  await db
    .update(campaignTrackers)
    .set({
      isPaused: paused,
      pauseReason: paused ? "MANUAL" : null,
      pauseSource: paused ? "manual" : null,
      lastPolledAt: new Date().toISOString(),
    })
    .where(eq(campaignTrackers.id, campaignId));
  revalidatePath("/ads");
  revalidatePath("/");
  return { ok: true as const };
}

export async function updateThresholds(
  campaignId: string,
  spendLimitThreshold: number,
  minRoasThreshold: number,
) {
  const db = await ensureDb();
  await db
    .update(campaignTrackers)
    .set({ spendLimitThreshold, minRoasThreshold })
    .where(eq(campaignTrackers.id, campaignId));
  revalidatePath("/ads");
}

export async function saveSentinelSettings(input: Partial<SentinelSettings> & { enabled?: boolean }) {
  const operator = await getOperator();
  if (!operator) throw new Error("Sign in with Google first.");
  const db = await ensureDb();
  const current = parseSentinelSettings(operator.sentinelSettings);
  const next = {
    ...DEFAULT_SENTINEL,
    ...current,
    ...input,
    hookSpend: Number(input.hookSpend ?? current.hookSpend),
    minCtr: Number(input.minCtr ?? current.minCtr),
    maxCpc: Number(input.maxCpc ?? current.maxCpc),
    intentSpend: Number(input.intentSpend ?? current.intentSpend),
    enabled: input.enabled ?? current.enabled,
  };
  await db
    .update(users)
    .set({ sentinelSettings: JSON.stringify(next) })
    .where(eq(users.id, operator.id));
  revalidatePath("/ads");
  revalidatePath("/settings");
  return next;
}
