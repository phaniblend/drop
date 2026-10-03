import "server-only";

import { eq } from "drizzle-orm";
import { ensureDb } from "./db";
import { getUserById } from "./db/queries";
import { settings } from "./db/schema";
import { stripeGet } from "./stripe";
import { stripeKeyMode } from "./stripe-keys";

export async function resolveMerchantStripeSecret(merchantId?: string | null) {
  if (!merchantId) return "";
  const user = await getUserById(merchantId);
  return user?.storeStripeSk?.trim() || "";
}

export function merchantHasLiveStripe(user?: { storeStripeSk?: string | null } | null) {
  return stripeKeyMode(user?.storeStripeSk) === "live";
}

export async function rememberCheckoutMerchant(sessionId: string, merchantId: string) {
  if (!sessionId || !merchantId) return;
  const db = await ensureDb();
  const key = `store_stripe_sess_${sessionId}`;
  await db.delete(settings).where(eq(settings.key, key));
  await db.insert(settings).values({ key, value: merchantId });
}

export async function loadCheckoutMerchant(sessionId: string) {
  const db = await ensureDb();
  const [row] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, `store_stripe_sess_${sessionId}`))
    .limit(1);
  return row?.value ?? null;
}

export async function verifyStripeSecret(secretKey: string) {
  const account = await stripeGet<{
    id?: string;
    livemode?: boolean;
    business_profile?: { name?: string };
    settings?: { dashboard?: { display_name?: string } };
    country?: string;
    charges_enabled?: boolean;
    payouts_enabled?: boolean;
  }>("account", secretKey);
  return {
    id: account.id ?? "",
    livemode: Boolean(account.livemode),
    businessName:
      account.business_profile?.name ||
      account.settings?.dashboard?.display_name ||
      account.id ||
      "",
    country: account.country || "",
    chargesEnabled: Boolean(account.charges_enabled),
    payoutsEnabled: Boolean(account.payouts_enabled),
  };
}
