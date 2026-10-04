import "server-only";

import { env, integrationStatus } from "./env";
import { stripeBillingHealth } from "./stripe-billing";
import { getOperator } from "./db/queries";
import { stripeKeyMode } from "./stripe-keys";
import { sellerPublishGaps, sellerPublishHint } from "./storefront";

export type GoLiveCheck = {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
  /** Who must act: code already done vs ops. */
  owner: "ready" | "railway" | "meta" | "you";
};

/** Platform (Seto) launch readiness — not per-merchant store setup. */
export async function getPlatformGoLive() {
  const billing = stripeBillingHealth({
    secretKey: env.stripeSecretKey,
    webhookSecret: env.stripeWebhookSecret,
    starterPrice: env.stripePriceStarter,
    scalerPrice: env.stripePriceScaler,
  });
  const integrations = integrationStatus();
  const operator = await getOperator();
  const metaHealth = await import("./meta-health").then((m) => m.getMetaHealth(false));
  const appUrl = (env.appUrl || "https://www.seto.store").replace(/\/$/, "");

  const authOk = Boolean(env.authSecret && env.googleId && env.googleSecret);
  const cronOk = Boolean(env.cronSecret);
  const metaAppOk = Boolean(env.metaAppId && env.metaAppSecret);
  const encryptionOk = Boolean(process.env.ENCRYPTION_KEY?.trim());
  const metaConnected = Boolean(metaHealth.live || metaHealth.degraded);
  const merchantTest = stripeKeyMode(operator?.storeStripeSk) === "test";
  const merchantLive = stripeKeyMode(operator?.storeStripeSk) === "live";
  const sellerMissing = sellerPublishGaps(operator);
  const sellerReady = sellerMissing.length === 0;

  const checks: GoLiveCheck[] = [
    {
      id: "auth",
      label: "Google login",
      ok: authOk,
      detail: authOk ? "AUTH_* keys are set." : "Set AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET on Railway.",
      owner: authOk ? "ready" : "railway",
    },
    {
      id: "app_url",
      label: "APP_URL",
      ok: Boolean(env.appUrl.includes("seto.store") || env.appUrl.startsWith("https://")),
      detail: `Public URL: ${appUrl}`,
      owner: "ready",
    },
    {
      id: "cron",
      label: "Hourly cron secret",
      ok: cronOk,
      detail: cronOk
        ? "CRON_SECRET is set — point cron-job.org at /api/cron/hourly."
        : "Set CRON_SECRET on Railway and schedule GET /api/cron/hourly.",
      owner: cronOk ? "ready" : "railway",
    },
    {
      id: "meta_app",
      label: "Meta app credentials",
      ok: metaAppOk && encryptionOk,
      detail:
        metaAppOk && encryptionOk
          ? "META_APP_ID / SECRET + ENCRYPTION_KEY ready for Login + App Review."
          : "Set META_APP_ID, META_APP_SECRET, and ENCRYPTION_KEY on Railway.",
      owner: metaAppOk && encryptionOk ? "ready" : "railway",
    },
    {
      id: "meta_desk",
      label: "Meta connected on a desk",
      ok: metaConnected,
      detail: metaConnected
        ? `Desk Meta: ${metaHealth.status}.`
        : "Connect with Facebook in Settings (admins/testers work before App Review).",
      owner: metaConnected ? "ready" : "you",
    },
    {
      id: "billing_live",
      label: "Platform Stripe (charge for Seto plans)",
      ok: billing.liveReady,
      detail: billing.liveReady
        ? "Live secret + prices + webhook — upgrades can take real cards."
        : billing.testReady
          ? "Test mode only. Soft launch OK; set sk_live_ + live price_ + webhook for paid plans."
          : "Set STRIPE_SECRET_KEY, STRIPE_PRICE_STARTER, STRIPE_PRICE_SCALER, STRIPE_WEBHOOK_SECRET.",
      owner: billing.liveReady ? "ready" : "railway",
    },
    {
      id: "smoke_seller",
      label: "Smoke-test store (optional for Seto launch)",
      ok: sellerReady && (merchantTest || merchantLive),
      detail: sellerReady
        ? merchantLive
          ? "Seller profile + live Stripe keys on this desk."
          : merchantTest
            ? "Seller profile + test Stripe — use a Stripe test card for one order."
            : "Add your own Stripe keys in Settings to run a store smoke order."
        : sellerPublishHint(sellerMissing) || "Add a business address in Settings.",
      owner: sellerReady && (merchantTest || merchantLive) ? "you" : "you",
    },
  ];

  const softLaunchOk = authOk && cronOk && metaAppOk && encryptionOk;
  const chargeOk = billing.liveReady;
  const metaReviewUrls = {
    privacy: `${appUrl}/privacy`,
    terms: `${appUrl}/terms`,
    oauthRedirect: `${appUrl}/api/meta/callback`,
    dataDeletion: `${appUrl}/api/meta/data-deletion`,
  };

  return {
    softLaunchOk,
    chargeOk,
    checks,
    metaReviewUrls,
    integrations: {
      aliexpress: integrations.aliexpress,
      gemini: Boolean(env.geminiApiKey),
    },
    billing,
  };
}
