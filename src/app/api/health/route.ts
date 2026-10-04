import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { stripeBillingHealth } from "@/lib/stripe-billing";

export const dynamic = "force-dynamic";

/** Public liveness + non-secret go-live flags (no tokens leaked). */
export async function GET() {
  const billing = stripeBillingHealth({
    secretKey: env.stripeSecretKey,
    webhookSecret: env.stripeWebhookSecret,
    starterPrice: env.stripePriceStarter,
    scalerPrice: env.stripePriceScaler,
  });

  const softLaunchOk = Boolean(
    env.authSecret &&
      env.googleId &&
      env.googleSecret &&
      env.cronSecret &&
      env.metaAppId &&
      env.metaAppSecret,
  );

  return NextResponse.json(
    {
      ok: true,
      softLaunchOk,
      chargePlansOk: billing.liveReady,
      billingMode: billing.mode,
      hasCron: Boolean(env.cronSecret),
      hasMetaApp: Boolean(env.metaAppId && env.metaAppSecret),
      commit: process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) || process.env.GITHUB_SHA?.slice(0, 7) || null,
    },
    { status: 200 },
  );
}
