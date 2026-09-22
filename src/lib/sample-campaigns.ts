import { nowIso } from "./utils";

/** Realistic sample campaigns so Ads & Guard is previewable before Meta/TikTok connect. */
export function sampleCampaignRows(productId?: string) {
  const base = nowIso();
  return [
    {
      id: "sample_meta_losing",
      productId: productId ?? null,
      platform: "meta",
      adAccountId: "sample_account",
      campaignId: "sample_campaign_a",
      adSetId: "sample_meta_1",
      adSetName: "SAMPLE — Hook A (losing)",
      spendToday: 42.5,
      revenueToday: 18,
      ordersCount: 1,
      spendLimitThreshold: 40,
      minRoasThreshold: 1.2,
      isPaused: false,
      impressions: 8200,
      clicks: 64,
      addToCartCount: 2,
      pauseReason: null as string | null,
      pauseSource: null as string | null,
      lastPolledAt: base,
      sample: true as const,
    },
    {
      id: "sample_tiktok_winner",
      productId: productId ?? null,
      platform: "tiktok",
      adAccountId: "sample_account",
      campaignId: "sample_campaign_b",
      adSetId: "sample_tt_1",
      adSetName: "SAMPLE — Hook B (winner)",
      spendToday: 28,
      revenueToday: 156,
      ordersCount: 4,
      spendLimitThreshold: 50,
      minRoasThreshold: 1.2,
      isPaused: false,
      impressions: 21000,
      clicks: 410,
      addToCartCount: 18,
      pauseReason: null as string | null,
      pauseSource: null as string | null,
      lastPolledAt: base,
      sample: true as const,
    },
    {
      id: "sample_meta_paused",
      productId: productId ?? null,
      platform: "meta",
      adAccountId: "sample_account",
      campaignId: "sample_campaign_c",
      adSetId: "sample_meta_2",
      adSetName: "SAMPLE — Hook C (auto-paused)",
      spendToday: 55,
      revenueToday: 12,
      ordersCount: 0,
      spendLimitThreshold: 50,
      minRoasThreshold: 1.2,
      isPaused: true,
      impressions: 15000,
      clicks: 90,
      addToCartCount: 1,
      pauseReason: "Spend crossed floor with negative net after fees",
      pauseSource: "guard",
      lastPolledAt: base,
      sample: true as const,
    },
  ];
}

export function isSampleCampaignId(id: string) {
  return id.startsWith("sample_");
}
