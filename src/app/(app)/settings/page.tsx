import { env, integrationStatus } from "@/lib/env";
import { getOperator } from "@/lib/db/queries";
import { getBillingSummary } from "@/lib/billing";
import { SettingsDesk } from "@/components/settings-desk";
import { shopifyStorefrontHomeUrl } from "@/lib/shopify-storefront";
import { shopifyAppCredentialsReady, shopifyIsConnected } from "@/lib/shopify-oauth";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ shopify?: string; shopify_error?: string }>;
}) {
  const params = await searchParams;
  const [user, status, billing, gemini, meta, storefrontUrl, shopifyLive] = await Promise.all([
    getOperator(),
    Promise.resolve(integrationStatus()),
    getBillingSummary(),
    import("@/lib/gemini-health").then((m) => m.getGeminiHealth(true)),
    import("@/lib/meta-health").then((m) => m.getMetaHealth(true)),
    shopifyStorefrontHomeUrl(),
    shopifyIsConnected(),
  ]);
  if (!user) {
    return <p className="text-sm text-muted">Sign in with Google to create the operator desk.</p>;
  }

  const shopifyOk = shopifyLive || status.shopify;
  const oauthConnected = Boolean(user.shopifyDomain?.trim() && user.shopifyAccessToken?.trim());
  const metaLive = meta.live;

  return (
    <SettingsDesk
      status={{
        ...status,
        shopify: shopifyOk,
        meta: metaLive,
        metaStatus: meta.status,
        metaError: meta.error,
        metaCheckedAt: meta.checkedAt,
        ai: gemini.live,
        aiConfigured: gemini.configured,
        aiError: gemini.error,
        aiModel: gemini.model,
        aiCheckedAt: gemini.checkedAt,
        liveCount: Object.values({
          shopify: shopifyOk,
          meta: metaLive,
          tiktok: status.tiktok,
          aliexpress: status.aliexpress,
          cj: Boolean(status.cj),
          serp: status.serp,
          ai: gemini.live,
        }).filter(Boolean).length,
      }}
      billing={billing}
      storefrontUrl={storefrontUrl}
      shopifyOAuth={{
        connected: oauthConnected,
        domain: user.shopifyDomain?.trim() || "",
        appReady: shopifyAppCredentialsReady(),
        flash:
          params.shopify === "connected"
            ? { tone: "ok" as const, message: "Shopify connected. You can publish from the catalog." }
            : params.shopify === "error"
              ? {
                  tone: "err" as const,
                  message: params.shopify_error || "Shopify Connect failed. Try again.",
                }
              : null,
      }}
      metaLongLived={Boolean(user.metaAccessToken?.trim()) || meta.longLived}
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
