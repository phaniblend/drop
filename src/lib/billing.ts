import "server-only";

import { eq, sql } from "drizzle-orm";
import { env } from "./env";
import { ensureDb } from "./db";
import { campaignTrackers, users } from "./db/schema";
import type { BillingSummary, PaywallPayload } from "./paywall";

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
  const [user] = await db.select().from(users).limit(1);
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
  const tier = asTier(user.subscriptionTier);
  const plan = PLAN_LIMITS[tier];
  const active = await db
    .select({ n: sql<number>`count(*)` })
    .from(campaignTrackers)
    .where(eq(campaignTrackers.isPaused, false));
  return {
    tier,
    status: user.subscriptionStatus,
    productsUsed: user.productsImportedCount,
    productsLimit: plan.products,
    lensUsed: user.lensSearchesCount,
    lensLimit: plan.lens,
    campaignsUsed: Number(active[0]?.n ?? 0),
    campaignsLimit: plan.campaigns,
    period: plan.period,
    label: plan.label,
    stripeReady: Boolean(env.stripeSecretKey && env.stripePriceStarter),
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

export async function incrementProductsImported() {
  const { db, user } = await loadUser();
  await db
    .update(users)
    .set({ productsImportedCount: sql`${users.productsImportedCount} + 1` })
    .where(eq(users.id, user.id));
}

export async function incrementLensSearches() {
  const { db, user } = await loadUser();
  await db
    .update(users)
    .set({ lensSearchesCount: sql`${users.lensSearchesCount} + 1` })
    .where(eq(users.id, user.id));
}

export async function applyStripeSubscription(input: {
  userId: string;
  customerId: string;
  subscriptionId: string;
  tier: "starter" | "scaler";
}) {
  const db = await ensureDb();
  const start = new Date().toISOString();
  await db
    .update(users)
    .set({
      subscriptionTier: input.tier,
      subscriptionStatus: "active",
      stripeCustomerId: input.customerId,
      stripeSubscriptionId: input.subscriptionId,
      billingCycleStart: start,
      billingCycleEnd: cycleEnd(),
    })
    .where(eq(users.id, input.userId));
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
}
