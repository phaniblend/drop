import { integrationStatus } from "@/lib/env";
import { DiscoverDesk } from "@/components/discover-desk";

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ canceled?: string }>;
}) {
  const status = integrationStatus();
  const { canceled } = await searchParams;
  return (
    <div className="space-y-4">
      {canceled ? (
        <p className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-muted">
          Checkout was canceled. You can keep using the 5-product trial.
        </p>
      ) : null}
      <DiscoverDesk
        aiLive={status.ai}
        serpLive={status.serp}
        cjLive={status.cj}
        aliApiLive={status.aliexpress}
      />
    </div>
  );
}
