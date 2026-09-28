"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { ensureDb, resetReadyCache } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { clearWorkspaceKeepOperator } from "@/lib/db/seed";
import { requireOperator } from "@/lib/db/queries";

export async function saveOperatorSettings(input: {
  displayName: string;
  storeName: string;
  email: string;
  markupMultiplier: number;
  spendLimitThreshold: number;
  minRoasThreshold: number;
  timezone?: string;
  daypartingEnabled?: boolean;
  supportEmail?: string;
  businessAddress?: string;
  metaPixelId?: string;
}) {
  const operator = await requireOperator();
  const db = await ensureDb();
  await db
    .update(users)
    .set({
      displayName: input.displayName,
      storeName: input.storeName,
      markupMultiplier: input.markupMultiplier,
      spendLimitThreshold: input.spendLimitThreshold,
      minRoasThreshold: input.minRoasThreshold,
      timezone: input.timezone?.trim() || "America/Chicago",
      daypartingEnabled: Boolean(input.daypartingEnabled),
      supportEmail: input.supportEmail?.trim() || null,
      businessAddress: input.businessAddress?.trim() || null,
      metaPixelId: (input.metaPixelId ?? "").replace(/\D/g, "") || null,
    })
    .where(eq(users.id, operator.id));
  revalidatePath("/settings");
  revalidatePath("/ads");
  revalidatePath("/");
}

export async function resetDemoData() {
  const operator = await requireOperator();
  const db = await ensureDb();
  await clearWorkspaceKeepOperator(db, operator.id);
  resetReadyCache();
  revalidatePath("/", "layout");
}

export async function repairCatalog() {
  const db = await ensureDb();
  const { repairCatalogData } = await import("@/lib/db/repair-catalog");
  const result = await repairCatalogData(db);
  resetReadyCache();
  revalidatePath("/", "layout");
  return result;
}

/** Exchange Graph Explorer short-lived token → ~60-day token; store on operator. */
export async function extendMetaAccessToken() {
  const { exchangeMetaLongLivedToken } = await import("@/lib/integrations/meta-token");
  const result = await exchangeMetaLongLivedToken();
  revalidatePath("/settings");
  revalidatePath("/ads");
  const days =
    result.expiresIn != null ? Math.max(1, Math.round(result.expiresIn / 86_400)) : null;
  return {
    ok: true as const,
    saved: result.saved,
    expiresInDays: days,
    message: result.saved
      ? days
        ? `Meta token extended (~${days} days). Guard will use the desk copy.`
        : "Meta token extended and saved on this desk."
      : "Token exchanged but no operator row to save. Sign in again, then retry Extend Meta token.",
  };
}

export async function saveStoreStripeKeys(input: { publishableKey: string; secretKey: string }) {
  const operator = await requireOperator();
  const { classifyStripeKeyPair } = await import("@/lib/stripe-keys");
  const classified = classifyStripeKeyPair(input.publishableKey, input.secretKey);
  if (!classified.ok) {
    return { ok: false as const, error: classified.error };
  }
  if (classified.mode === "live") {
    try {
      const { verifyStripeSecret } = await import("@/lib/merchant-stripe");
      const account = await verifyStripeSecret(input.secretKey.trim());
      if (!account.livemode) {
        return { ok: false as const, error: "Those keys are not live. Use pk_live_… and sk_live_… from Stripe." };
      }
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "Stripe rejected those keys.",
      };
    }
  }
  const db = await ensureDb();
  await db
    .update(users)
    .set({
      storeStripePk: input.publishableKey.trim(),
      storeStripeSk: input.secretKey.trim(),
    })
    .where(eq(users.id, operator.id));
  const { invalidateDeskShell } = await import("@/lib/desk-shell");
  invalidateDeskShell();
  revalidatePath("/settings");
  revalidatePath("/");
  return {
    ok: true as const,
    mode: classified.mode,
    message:
      classified.mode === "live"
        ? "Live Stripe keys saved. Store checkout now takes real cards."
        : "Test keys saved. Store checkout stays in Stripe sandbox until you add live keys.",
  };
}

export async function disconnectShopify() {
  const { clearShopifyOAuthConnection } = await import("@/lib/shopify-oauth");
  const { invalidateDeskShell } = await import("@/lib/desk-shell");
  await clearShopifyOAuthConnection();
  invalidateDeskShell();
  revalidatePath("/settings");
  revalidatePath("/");
  revalidatePath("/catalog");
  return { ok: true as const, message: "Shopify disconnected from this desk." };
}
