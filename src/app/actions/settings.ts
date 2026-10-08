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
  const { isSuperuser } = await import("@/lib/superuser");
  if (!isSuperuser(operator.email)) throw new Error("Only the desk owner can clear a workspace.");
  const db = await ensureDb();
  await clearWorkspaceKeepOperator(db, operator.id);
  resetReadyCache();
  revalidatePath("/", "layout");
}

export async function repairCatalog() {
  const operator = await requireOperator();
  const { isSuperuser } = await import("@/lib/superuser");
  if (!isSuperuser(operator.email)) throw new Error("Only the desk owner can run catalog repair.");
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
  const days =
    result.expiresIn != null ? Math.max(1, Math.round(result.expiresIn / 86_400)) : null;
  // Don't revalidate here — it remounts Settings and wipes the on-screen result message.
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
      const flags = [
        account.chargesEnabled ? "charges on" : "charges off",
        account.payoutsEnabled ? "payouts on" : "payouts off",
      ].join(", ");
      return {
        ok: true as const,
        mode: classified.mode,
        message: `Live Stripe connected${account.businessName ? ` as ${account.businessName}` : ""}${account.country ? ` (${account.country})` : ""} — ${flags}.`,
      };
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
    message: "Test keys saved. Store checkout stays in Stripe sandbox until you add live keys.",
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

export async function connectMetaWithToken(shortLivedToken: string) {
  const { saveMetaConnectionFromToken } = await import("@/lib/integrations/meta-oauth");
  const result = await saveMetaConnectionFromToken(shortLivedToken.trim());
  revalidatePath("/settings");
  revalidatePath("/ads");
  revalidatePath("/");
  return {
    ok: true as const,
    message: `Meta connected as ${result.userName}. ${result.accounts} ad account${result.accounts === 1 ? "" : "s"} found.`,
  };
}

export async function saveMarginGuardMode(input: {
  mode: "OFF" | "ALERT_ONLY" | "AUTO_PAUSE";
  consentAutoPause?: boolean;
}) {
  const { saveGuardMode } = await import("@/lib/margin-guard-v2/finance-config");
  const cfg = await saveGuardMode(input);
  revalidatePath("/settings");
  revalidatePath("/ads");
  return {
    ok: true as const,
    mode: cfg.guardMode,
    message:
      cfg.guardMode === "AUTO_PAUSE"
        ? "Auto-pause is on. Seto can pause losing ad sets."
        : cfg.guardMode === "ALERT_ONLY"
          ? "Alert-only mode — Seto will warn but not pause."
          : "Margin Guard is off for this store.",
  };
}

export async function saveTikTokCredentials(input: { accessToken: string; advertiserId: string }) {
  const operator = await requireOperator();
  const token = input.accessToken.trim();
  const advertiserId = input.advertiserId.trim().replace(/\D/g, "");
  if (token.length < 20) throw new Error("Paste a TikTok Marketing API access token.");
  if (advertiserId.length < 5) throw new Error("Paste your TikTok advertiser id.");
  const db = await ensureDb();
  await db
    .update(users)
    .set({
      tiktokAccessToken: token,
    })
    .where(eq(users.id, operator.id));
  // Advertiser id is host/env today; store on user notes via settings key until schema expands.
  const { settings } = await import("@/lib/db/schema");
  const key = `tiktok_advertiser_${operator.id}`;
  await db.delete(settings).where(eq(settings.key, key));
  await db.insert(settings).values({ key, value: advertiserId });
  const { invalidateDeskShell } = await import("@/lib/desk-shell");
  invalidateDeskShell();
  revalidatePath("/settings");
  revalidatePath("/ads");
  return { ok: true as const, message: "TikTok ads credentials saved for this desk." };
}

export async function saveMetaAdAccount(adAccountId: string) {
  const operator = await requireOperator();
  const id = adAccountId.trim();
  if (!id) throw new Error("Pick an ad account.");
  const db = await ensureDb();
  const { metaAdAccounts, metaConnections } = await import("@/lib/db/schema-guard");
  const { and, eq: eq2 } = await import("drizzle-orm");
  const rows = await db
    .select({
      id: metaAdAccounts.id,
      connId: metaConnections.id,
    })
    .from(metaAdAccounts)
    .innerJoin(metaConnections, eq2(metaAdAccounts.metaConnectionId, metaConnections.id))
    .where(and(eq2(metaConnections.storeId, operator.id), eq2(metaAdAccounts.id, id)))
    .limit(1);
  if (!rows[0]) throw new Error("That ad account is not linked to this desk.");
  const owned = await db
    .select({ id: metaAdAccounts.id })
    .from(metaAdAccounts)
    .innerJoin(metaConnections, eq2(metaAdAccounts.metaConnectionId, metaConnections.id))
    .where(eq2(metaConnections.storeId, operator.id));
  for (const row of owned) {
    await db
      .update(metaAdAccounts)
      .set({ guardEnabled: row.id === id })
      .where(eq2(metaAdAccounts.id, row.id));
  }
  const { settings } = await import("@/lib/db/schema");
  const key = `meta_ad_account_${operator.id}`;
  await db.delete(settings).where(eq(settings.key, key));
  await db.insert(settings).values({ key, value: id });
  try {
    await import("@/lib/meta-health").then((m) => m.getMetaHealth(true));
  } catch {
    /* health refresh is best-effort */
  }
  revalidatePath("/settings");
  revalidatePath("/ads");
  revalidatePath("/");
  return { ok: true as const, message: `Margin Guard will use ${id}.` };
}
