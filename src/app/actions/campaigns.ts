"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { ensureDb } from "@/lib/db";
import { listCampaigns } from "@/lib/db/queries";
import { campaignTrackers } from "@/lib/db/schema";
import { logActivity } from "@/lib/db/seed";
import { runSafetyCircuitCheck } from "@/lib/margin-guard";

export async function runCampaignGuard(campaignId: string) {
  const campaigns = await listCampaigns();
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
  });

  const db = await ensureDb();
  const paused = result.actionTaken === "KILLED_CAMPAIGN";
  await db
    .update(campaignTrackers)
    .set({
      isPaused: paused ? true : campaign.isPaused,
      spendToday: result.currentSpend,
      lastPolledAt: new Date().toISOString(),
    })
    .where(eq(campaignTrackers.id, campaignId));

  await logActivity(db, {
    kind: paused ? "alert" : "ads",
    message: paused
      ? `Margin Guard paused ${campaign.adSetName} (net ${result.netProfit.toFixed(2)}).`
      : `${campaign.adSetName} passed circuit check (net ${result.netProfit.toFixed(2)}).`,
    href: "/ads",
  });

  revalidatePath("/ads");
  revalidatePath("/");
  return result;
}

export async function runAllGuards() {
  const campaigns = await listCampaigns();
  const results = [];
  for (const c of campaigns) {
    results.push(await runCampaignGuard(c.id));
  }
  return results;
}

export async function togglePause(campaignId: string, paused: boolean) {
  const db = await ensureDb();
  await db
    .update(campaignTrackers)
    .set({ isPaused: paused, lastPolledAt: new Date().toISOString() })
    .where(eq(campaignTrackers.id, campaignId));
  revalidatePath("/ads");
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
