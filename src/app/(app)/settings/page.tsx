import { integrationStatus } from "@/lib/env";
import { getOperator } from "@/lib/db/queries";
import { getBillingSummary } from "@/lib/billing";
import { SettingsDesk } from "@/components/settings-desk";
import { shopifyStorefrontHomeUrl } from "@/lib/shopify-storefront";

export default async function SettingsPage() {
  const [user, status, billing] = await Promise.all([
    getOperator(),
    Promise.resolve(integrationStatus()),
    getBillingSummary(),
  ]);
  if (!user) {
    return <p className="text-sm text-muted">Sign in with Google to create the operator desk.</p>;
  }
  return (
    <SettingsDesk
      status={status}
      billing={billing}
      storefrontUrl={shopifyStorefrontHomeUrl()}
      user={{
        displayName: user.displayName,
        storeName: user.storeName,
        email: user.email,
        markupMultiplier: user.markupMultiplier,
        spendLimitThreshold: user.spendLimitThreshold,
        minRoasThreshold: user.minRoasThreshold,
        timezone: user.timezone,
        daypartingEnabled: Boolean(user.daypartingEnabled),
      }}
    />
  );
}
