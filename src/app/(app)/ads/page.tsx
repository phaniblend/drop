import { listCampaigns } from "@/lib/db/queries";
import { AdsDesk } from "@/components/ads-desk";

export default async function AdsPage() {
  const campaigns = await listCampaigns();
  return <AdsDesk campaigns={campaigns} />;
}
