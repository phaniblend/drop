import { integrationStatus } from "@/lib/env";
import { getOperator } from "@/lib/db/queries";
import { SettingsDesk } from "@/components/settings-desk";

export default async function SettingsPage() {
  const [user, status] = await Promise.all([getOperator(), Promise.resolve(integrationStatus())]);
  if (!user) {
    return <p className="text-sm text-muted">No operator profile. Restart the app to seed.</p>;
  }
  return (
    <SettingsDesk
      status={status}
      user={{
        displayName: user.displayName,
        storeName: user.storeName,
        email: user.email,
        markupMultiplier: user.markupMultiplier,
        spendLimitThreshold: user.spendLimitThreshold,
        minRoasThreshold: user.minRoasThreshold,
      }}
    />
  );
}
