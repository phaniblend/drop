import "server-only";

import { eq } from "drizzle-orm";
import { ensureDb } from "./db";
import { getUserById } from "./db/queries";
import { settings } from "./db/schema";
import { env } from "./env";
import { stripeGet } from "./stripe";
import { stripeKeyMode } from "./stripe-keys";

export async function resolveMerchantStripeSecret(merchantId?: string | null) {
  if (merchantId) {
    const user = await getUserById(merchantId);
    const key = user?.storeStripeSk?.trim();
    if (key) return key;
  }
  return env.stripeSecretKey.trim();
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
  const account = await stripeGet<{ id?: string; livemode?: boolean }>("account", secretKey);
  return { id: account.id ?? "", livemode: Boolean(account.livemode) };
}
