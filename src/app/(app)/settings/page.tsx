import { env, integrationStatus } from "@/lib/env";
import { getOperator } from "@/lib/db/queries";
import { getBillingSummary } from "@/lib/billing";
import { SettingsDesk } from "@/components/settings-desk";
import { shopifyStorefrontHomeUrl } from "@/lib/shopify-storefront";
import { storeHomePath } from "@/lib/store-slug";
import { shopifyAppCredentialsReady, shopifyIsConnected } from "@/lib/shopify-oauth";
import { maskStripeKey, stripeKeyMode } from "@/lib/stripe-keys";
import { isSuperuser } from "@/lib/superuser";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    shopify?: string;
    shopify_error?: string;
    meta?: string;
    meta_error?: string;
  }>;
}) {
  const params = await searchParams;
  const [user, status, billing, gemini, meta, storefrontUrl, shopifyLive, goLive] = await Promise.all([
    getOperator(),
    Promise.resolve(integrationStatus()),
    getBillingSummary(),
    import("@/lib/gemini-health").then((m) => m.getGeminiHealth(true)),
    import("@/lib/meta-health").then((m) => m.getMetaHealth(true)),
    shopifyStorefrontHomeUrl(),
    shopifyIsConnected(),
    import("@/lib/go-live").then((m) => m.getPlatformGoLive()),
  ]);
  if (!user) {
    return <p className="text-sm text-muted">Sign in with Google to create the operator desk.</p>;
  }

  const finance = await import("@/lib/margin-guard-v2/finance-config").then((m) =>
    m.getOrCreateFinanceConfig(user.id),
  );
  const metaAccounts = await import("@/lib/db").then(async ({ ensureDb }) => {
    const db = await ensureDb();
    const { metaAdAccounts, metaConnections } = await import("@/lib/db/schema-guard");
    const { eq: eq2 } = await import("drizzle-orm");
    return db
      .select({
        id: metaAdAccounts.id,
        name: metaAdAccounts.name,
        currency: metaAdAccounts.currency,
        guardEnabled: metaAdAccounts.guardEnabled,
      })
      .from(metaAdAccounts)
      .innerJoin(metaConnections, eq2(metaAdAccounts.metaConnectionId, metaConnections.id))
      .where(eq2(metaConnections.storeId, user.id));
  });

  const oauthConnected = Boolean(user.shopifyDomain?.trim() && user.shopifyAccessToken?.trim());
  const shopifyOk = oauthConnected || shopifyLive;
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
          tiktok: status.tiktok || Boolean(user.tiktokAccessToken?.trim()),
          aliexpress: status.aliexpress,
          cj: Boolean(status.cj),
          serp: status.serp,
          ai: gemini.live,
        }).filter(Boolean).length,
      }}
      billing={billing}
      storefrontUrl={storefrontUrl}
      storeHref={storeHomePath(user.storeSlug)}
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
      metaOAuth={{
        connected: Boolean(user.metaAccessToken?.trim()),
        flash:
          params.meta === "connected"
            ? { tone: "ok" as const, message: "Meta Login connected. Insights sync can run." }
            : params.meta === "error" || params.meta === "missing_app"
              ? {
                  tone: "err" as const,
                  message:
                    params.meta === "missing_app"
                      ? "Meta app id/secret are not configured on this host."
                      : params.meta_error || "Meta Login failed. Try again.",
                }
              : null,
      }}
      guardMode={(finance.guardMode as "OFF" | "ALERT_ONLY" | "AUTO_PAUSE") || "ALERT_ONLY"}
      metaAccounts={metaAccounts}
      user={{
        displayName: user.displayName,
        storeName: user.storeName,
        email: user.email,
        markupMultiplier: user.markupMultiplier,
        spendLimitThreshold: user.spendLimitThreshold,
        minRoasThreshold: user.minRoasThreshold,
        timezone: user.timezone,
        daypartingEnabled: Boolean(user.daypartingEnabled),
        supportEmail: user.supportEmail ?? "",
        businessAddress: user.businessAddress ?? "",
        metaPixelId: user.metaPixelId ?? "",
      }}
      stripeKeys={{
        publishableMasked: maskStripeKey(user.storeStripePk),
        secretMasked: maskStripeKey(user.storeStripeSk),
        mode: stripeKeyMode(user.storeStripeSk),
      }}
      goLive={
        isSuperuser(user.email)
          ? {
              softLaunchOk: goLive.softLaunchOk,
              chargeOk: goLive.chargeOk,
              checks: goLive.checks,
              metaReviewUrls: goLive.metaReviewUrls,
            }
          : null
      }
      isSuperuser={isSuperuser(user.email)}
    />
  );
}
