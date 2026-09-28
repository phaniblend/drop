import "server-only";

import { eq, sql } from "drizzle-orm";
import { env } from "./env";
import { ensureDb } from "./db";
import { campaignTrackers, users } from "./db/schema";
import type { BillingSummary, PaywallPayload } from "./paywall";
import { isSuperuser } from "./superuser";
import { mapStripeSubscriptionStatus, stripeBillingHealth } from "./stripe-billing";

export type { BillingSummary };

export type SubscriptionTier = "trial_5" | "starter" | "scaler";

export const PLAN_LIMITS = {
  trial_5: { products: 5, lens: 5, campaigns: 1, period: "lifetime" as const, price: 0, label: "Free trial" },
  starter: { products: 30, lens: 50, campaigns: 5, period: "month" as const, price: 19, label: "Starter" },
  scaler: { products: 120, lens: 200, campaigns: Number.POSITIVE_INFINITY, period: "month" as const, price: 39, label: "Scaler" },
} as const;

export class BillingError extends Error {
  readonly paywall: PaywallPayload;

  constructor(paywall: PaywallPayload) {
    super(paywall.message);
    this.name = "BillingError";
    this.paywall = paywall;
  }
}

export function isBillingError(error: unknown): error is BillingError {
  return error instanceof BillingError;
}

function asTier(value: string | null | undefined): SubscriptionTier {
  if (value === "starter" || value === "scaler") return value;
  return "trial_5";
}

function cycleEnd(from = new Date()) {
  const next = new Date(from);
  next.setUTCDate(next.getUTCDate() + 30);
  return next.toISOString();
}

async function loadUser() {
  const db = await ensureDb();
  const { auth } = await import("@/auth");
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) throw new Error("Sign in with Google first.");
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) throw new Error("Sign in with Google first.");
  return { db, user };
}

async function maybeResetCycle() {
  const { db, user } = await loadUser();
  const tier = asTier(user.subscriptionTier);
  if (tier === "trial_5") return user;
  const end = user.billingCycleEnd ? Date.parse(user.billingCycleEnd) : 0;
  if (end && end > Date.now()) return user;
  const start = new Date().toISOString();
  await db
    .update(users)
    .set({
      productsImportedCount: 0,
      lensSearchesCount: 0,
      billingCycleStart: start,
      billingCycleEnd: cycleEnd(),
    })
    .where(eq(users.id, user.id));
  const [fresh] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  return fresh ?? user;
}

export async function getBillingSummary(): Promise<BillingSummary> {
  const user = await maybeResetCycle();
  const db = await ensureDb();
  const active = await db
    .select({ n: sql<number>`count(*)` })
    .from(campaignTrackers)
    .where(eq(campaignTrackers.isPaused, false));
  const campaignsUsed = Number(active[0]?.n ?? 0);

  const health = stripeBillingHealth({
    secretKey: env.stripeSecretKey,
    webhookSecret: env.stripeWebhookSecret,
    starterPrice: env.stripePriceStarter,
    scalerPrice: env.stripePriceScaler,
  });
  const stripeReady = health.liveReady || health.testReady;

  if (isSuperuser(user.email)) {
    return {
      tier: "scaler",
      status: "active",
      productsUsed: user.productsImportedCount,
      productsLimit: Number.POSITIVE_INFINITY,
      lensUsed: user.lensSearchesCount,
      lensLimit: Number.POSITIVE_INFINITY,
      campaignsUsed,
      campaignsLimit: Number.POSITIVE_INFINITY,
      period: "month",
      label: "Superuser",
      stripeReady,
      hasCustomer: Boolean(user.stripeCustomerId),
      health,
    };
  }

  const tier = asTier(user.subscriptionTier);
  const plan = PLAN_LIMITS[tier];
  return {
    tier,
    status: user.subscriptionStatus,
    productsUsed: user.productsImportedCount,
    productsLimit: plan.products,
    lensUsed: user.lensSearchesCount,
    lensLimit: plan.lens,
    campaignsUsed,
    campaignsLimit: plan.campaigns,
    period: plan.period,
    label: plan.label,
    stripeReady,
    hasCustomer: Boolean(user.stripeCustomerId),
    health,
  };
}

function paidPastDue(tier: SubscriptionTier, status: string): PaywallPayload | null {
  if ((tier === "starter" || tier === "scaler") && status !== "active") {
    return {
      code: "SUBSCRIPTION_PAST_DUE",
      message: "Your recurring billing is past due. Please update your payment method.",
    };
  }
  return null;
}

export async function assertProductQuota() {
  const user = await maybeResetCycle();
  if (isSuperuser(user.email)) return;
  const tier = asTier(user.subscriptionTier);
  const due = paidPastDue(tier, user.subscriptionStatus);
  if (due) throw new BillingError(due);
  const limit = PLAN_LIMITS[tier].products;
  if (user.productsImportedCount >= limit) {
    throw new BillingError({
      code: "TRIAL_LIMIT_REACHED",
      resource: "products",
      limit,
      used: user.productsImportedCount,
      message:
        tier === "trial_5"
          ? "You have tested your 5 free products. Upgrade to Starter ($19/mo) to keep importing."
          : `You have used all ${limit} product imports this billing cycle.`,
    });
  }
}

export async function assertLensQuota() {
  const user = await maybeResetCycle();
  if (isSuperuser(user.email)) return;
  const tier = asTier(user.subscriptionTier);
  const due = paidPastDue(tier, user.subscriptionStatus);
  if (due) throw new BillingError(due);
  const limit = PLAN_LIMITS[tier].lens;
  if (user.lensSearchesCount >= limit) {
    throw new BillingError({
      code: "LENS_LIMIT_REACHED",
      resource: "lens",
      limit,
      used: user.lensSearchesCount,
      message:
        tier === "trial_5"
          ? "You have used your 5 free Lens lookups. Upgrade to keep reverse-searching ads."
          : `You have used all ${limit} Lens lookups this billing cycle.`,
    });
  }
}

export async function assertCampaignUnpause() {
  const user = await maybeResetCycle();
  if (isSuperuser(user.email)) return;
  const tier = asTier(user.subscriptionTier);
  const due = paidPastDue(tier, user.subscriptionStatus);
  if (due) throw new BillingError(due);
  const limit = PLAN_LIMITS[tier].campaigns;
  if (!Number.isFinite(limit)) return;
  const db = await ensureDb();
  const active = await db
    .select({ n: sql<number>`count(*)` })
    .from(campaignTrackers)
    .where(eq(campaignTrackers.isPaused, false));
  const used = Number(active[0]?.n ?? 0);
  if (used >= limit) {
    throw new BillingError({
      code: "CAMPAIGN_LIMIT_REACHED",
      resource: "campaigns",
      limit,
      used,
      message:
        tier === "trial_5"
          ? "Free trial watches 1 campaign. Upgrade to Starter to monitor up to 5."
          : `This plan watches ${limit} campaigns at a time.`,
    });
  }
}

async function refreshDeskShell() {
  const { invalidateDeskShell } = await import("./desk-shell");
  invalidateDeskShell();
}

export async function incrementProductsImported() {
  const { db, user } = await loadUser();
  await db
    .update(users)
    .set({ productsImportedCount: sql`${users.productsImportedCount} + 1` })
    .where(eq(users.id, user.id));
  await refreshDeskShell();
}

export async function incrementLensSearches() {
  const { db, user } = await loadUser();
  await db
    .update(users)
    .set({ lensSearchesCount: sql`${users.lensSearchesCount} + 1` })
    .where(eq(users.id, user.id));
  await refreshDeskShell();
}

export async function fulfillBillingCheckout(sessionId: string) {
  if (!sessionId) return false;
  const { stripeGet } = await import("./stripe");
  const session = await stripeGet<{
    mode?: string;
    payment_status?: string;
    customer?: string;
    subscription?: string;
    metadata?: { userId?: string; plan?: string };
  }>(`checkout/sessions/${sessionId}`);
  if (session.mode !== "subscription") return false;
  if (session.payment_status && session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
    return false;
  }
  return applyStripeSubscription({
    userId: session.metadata?.userId,
    customerId: typeof session.customer === "string" ? session.customer : undefined,
    subscriptionId: typeof session.subscription === "string" ? session.subscription : undefined,
    tier: session.metadata?.plan === "scaler" ? "scaler" : "starter",
    status: "active",
  });
}

export async function applyStripeSubscription(input: {
  userId?: string;
  customerId?: string;
  subscriptionId?: string;
  tier?: "starter" | "scaler";
  status?: string | null;
}) {
  const db = await ensureDb();
  const status = mapStripeSubscriptionStatus(input.status ?? "active");
  const [byUser] = input.userId
    ? await db.select().from(users).where(eq(users.id, input.userId)).limit(1)
    : [];
  const [bySub] =
    !byUser && input.subscriptionId
      ? await db.select().from(users).where(eq(users.stripeSubscriptionId, input.subscriptionId)).limit(1)
      : [];
  const [byCustomer] =
    !byUser && !bySub && input.customerId
      ? await db.select().from(users).where(eq(users.stripeCustomerId, input.customerId)).limit(1)
      : [];
  const user = byUser ?? bySub ?? byCustomer;
  if (!user) return false;

  const tier =
    status === "canceled"
      ? "trial_5"
      : input.tier ?? (user.subscriptionTier === "scaler" ? "scaler" : "starter");
  const start = new Date().toISOString();
  await db
    .update(users)
    .set({
      subscriptionTier: tier,
      subscriptionStatus: status === "canceled" ? "canceled" : status,
      stripeCustomerId: input.customerId || user.stripeCustomerId,
      stripeSubscriptionId: input.subscriptionId || user.stripeSubscriptionId,
      billingCycleStart: status === "active" ? start : user.billingCycleStart,
      billingCycleEnd: status === "active" ? cycleEnd() : user.billingCycleEnd,
    })
    .where(eq(users.id, user.id));
  const { invalidateDeskShell } = await import("./desk-shell");
  invalidateDeskShell();
  return true;
}

export async function cancelStripeSubscription(subscriptionId: string) {
  const db = await ensureDb();
  await db
    .update(users)
    .set({
      subscriptionTier: "trial_5",
      subscriptionStatus: "canceled",
    })
    .where(eq(users.stripeSubscriptionId, subscriptionId));
  const { invalidateDeskShell } = await import("./desk-shell");
  invalidateDeskShell();
}
