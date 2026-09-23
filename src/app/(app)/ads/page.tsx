import { getOperator, listActivity, listCampaigns } from "@/lib/db/queries";
import { env, integrationStatus } from "@/lib/env";
import { AdsDesk } from "@/components/ads-desk";

export default async function AdsPage() {
  const integrations = integrationStatus();
  let metaSync: { adAccountId: string; error: string | null; synced: number; count: number } | null =
    null;

  if (integrations.meta) {
    try {
      const { syncMetaAdSetsIntoTrackers } = await import("@/lib/integrations/meta-ads");
      const sync = await syncMetaAdSetsIntoTrackers();
      metaSync = {
        adAccountId: sync.adAccountId || env.metaAdAccountId || "unknown",
        error: sync.error,
        synced: sync.synced,
        count: sync.adSets.length,
      };
    } catch (e) {
      metaSync = {
        adAccountId: env.metaAdAccountId || "unknown",
        error: e instanceof Error ? e.message : "Meta sync failed",
        synced: 0,
        count: 0,
      };
    }
  }

  const [campaigns, operator, activity] = await Promise.all([
    listCampaigns(),
    getOperator(),
    listActivity(8),
  ]);

  return (
    <AdsDesk
      campaigns={campaigns}
      sentinelRaw={operator?.sentinelSettings ?? ""}
      daypartingEnabled={Boolean(operator?.daypartingEnabled)}
      adsLive={Boolean(integrations.meta || integrations.tiktok)}
      metaAccountId={metaSync?.adAccountId || env.metaAdAccountId || ""}
      metaError={metaSync?.error || null}
      metaFetchedCount={metaSync?.count ?? null}
      guardLog={activity.filter((item) => item.kind === "ads" || item.kind === "alert").slice(0, 6)}
    />
  );
}
