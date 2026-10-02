import { getOperator, listActivity, listCampaigns } from "@/lib/db/queries";
import { env, integrationStatus } from "@/lib/env";
import { AdsDesk } from "@/components/ads-desk";

export default async function AdsPage() {
  const integrations = integrationStatus();
  const metaHealth = await import("@/lib/meta-health").then((m) => m.getMetaHealth(false));
  let metaSync: { adAccountId: string; error: string | null; synced: number; count: number } | null =
    null;

  if (metaHealth.live || metaHealth.degraded) {
    try {
      const { syncMetaAdSetsIntoTrackers } = await import("@/lib/integrations/meta-ads");
      const sync = await syncMetaAdSetsIntoTrackers();
      metaSync = {
        adAccountId: sync.adAccountId || env.metaAdAccountId || "unknown",
        error: sync.error || metaHealth.error,
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

  const finance = operator
    ? await import("@/lib/margin-guard-v2/finance-config").then((m) =>
        m.getOrCreateFinanceConfig(operator.id),
      )
    : null;

  const adsetIds = campaigns.map((c) => c.adSetId).filter(Boolean);
  const whyByAdset =
    adsetIds.length > 0
      ? await import("@/lib/margin-guard-v2/run-evaluate").then((m) =>
          m.listLatestEvaluationsForAdsets(adsetIds),
        )
      : {};

  const adsLive = Boolean(metaHealth.live || integrations.tiktok);

  return (
    <AdsDesk
      campaigns={campaigns}
      sentinelRaw={operator?.sentinelSettings ?? ""}
      daypartingEnabled={Boolean(operator?.daypartingEnabled)}
      adsLive={adsLive}
      metaFullyConnected={metaHealth.live}
      metaDegraded={metaHealth.degraded}
      metaAccountId={metaSync?.adAccountId || env.metaAdAccountId || ""}
      metaError={metaSync?.error || metaHealth.error || null}
      metaFetchedCount={metaSync?.count ?? null}
      guardMode={finance?.guardMode ?? "ALERT_ONLY"}
      whyByAdset={whyByAdset}
      guardLog={activity.filter((item) => item.kind === "ads" || item.kind === "alert").slice(0, 6)}
    />
  );
}
