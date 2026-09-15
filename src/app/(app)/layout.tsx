import { integrationStatus } from "@/lib/env";
import { getOperator } from "@/lib/db/queries";
import { Shell } from "@/components/shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, integrations] = await Promise.all([getOperator(), Promise.resolve(integrationStatus())]);
  return (
    <Shell storeName={user?.storeName ?? "DropshipOS"} liveCount={integrations.liveCount}>
      {children}
    </Shell>
  );
}
