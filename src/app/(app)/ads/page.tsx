import { getOperator, listCampaigns } from "@/lib/db/queries";
import { AdsDesk } from "@/components/ads-desk";

export default async function AdsPage() {
  const [campaigns, operator] = await Promise.all([listCampaigns(), getOperator()]);
  return (
    <AdsDesk
      campaigns={campaigns}
      sentinelRaw={operator?.sentinelSettings ?? ""}
      daypartingEnabled={Boolean(operator?.daypartingEnabled)}
    />
  );
}
