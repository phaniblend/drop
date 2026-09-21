import { getOperator, listActivity, listCampaigns } from "@/lib/db/queries";
import { integrationStatus } from "@/lib/env";
import { AdsDesk } from "@/components/ads-desk";

export default async function AdsPage() {
  const [campaigns, operator, activity, integrations] = await Promise.all([
    listCampaigns(),
    getOperator(),
    listActivity(8),
    Promise.resolve(integrationStatus()),
  ]);
  return (
    <AdsDesk
      campaigns={campaigns}
      sentinelRaw={operator?.sentinelSettings ?? ""}
      daypartingEnabled={Boolean(operator?.daypartingEnabled)}
      adsLive={Boolean(integrations.meta || integrations.tiktok)}
      guardLog={activity.filter((item) => item.kind === "ads" || item.kind === "alert").slice(0, 6)}
    />
  );
}
