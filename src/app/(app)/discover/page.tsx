import { integrationStatus } from "@/lib/env";
import { SUPPLIER_FEED } from "@/lib/supplier-feed";
import { DiscoverDesk } from "@/components/discover-desk";

export default function DiscoverPage() {
  const status = integrationStatus();
  return (
    <DiscoverDesk
      feed={SUPPLIER_FEED}
      aiLive={status.ai}
      serpLive={status.serp}
      aliLive={status.aliexpress}
    />
  );
}
