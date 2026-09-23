import { env, integrationStatus } from "@/lib/env";
import { getOperator } from "@/lib/db/queries";
import { getBillingSummary } from "@/lib/billing";
import { SettingsDesk } from "@/components/settings-desk";
import { shopifyStorefrontHomeUrl } from "@/lib/shopify-storefront";

export default async function SettingsPage() {
  const [user, status, billing, gemini] = await Promise.all([
    getOperator(),
    Promise.resolve(integrationStatus()),
    getBillingSummary(),
    import("@/lib/gemini-health").then((m) => m.getGeminiHealth(true)),
  ]);
  if (!user) {
    return <p className="text-sm text-muted">Sign in with Google to create the operator desk.</p>;
  }
  return (
    <SettingsDesk
      status={{
        ...status,
        ai: gemini.live,
        aiConfigured: gemini.configured,
        aiError: gemini.error,
        aiModel: gemini.model,
        aiCheckedAt: gemini.checkedAt,
        liveCount: Object.values({
          shopify: status.shopify,
          meta: status.meta,
          tiktok: status.tiktok,
          aliexpress: status.aliexpress,
          cj: Boolean(status.cj),
          serp: status.serp,
          ai: gemini.live,
        }).filter(Boolean).length,
      }}
      billing={billing}
      storefrontUrl={shopifyStorefrontHomeUrl()}
      metaLongLived={Boolean(user.metaAccessToken?.trim())}
      canExtendMeta={Boolean(env.metaAppId && env.metaAppSecret && (env.metaToken || user.metaAccessToken))}
      metaAppReady={Boolean(env.metaAppId && env.metaAppSecret)}
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
