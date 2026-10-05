import "server-only";

import { integrationStatus } from "./env";
import { ensureDb } from "./db";
import { getOperator, getUserByEmail } from "./db/queries";
import { provisionOperator } from "./db/seed";
import { getBillingSummary, type BillingSummary } from "./billing";
import { stripeCheckoutMode } from "./stripe-mode";
import { maskStripeKey } from "./stripe-keys";
import { storeHomePath } from "./store-slug";

export type DeskShell = {
  storeName: string;
  displayName: string;
  storeSlug: string;
  storeHref: string;
  billing: BillingSummary;
  liveCount: number;
  stripeMode: "off" | "test" | "live";
  stripePkMasked: string;
  stripeSkMasked: string;
};

const globalForDesk = globalThis as unknown as {
  setoDesk?: { email: string; at: number; shell: DeskShell };
};

const TTL_MS = 25_000;

export function invalidateDeskShell() {
  globalForDesk.setoDesk = undefined;
}

export async function loadDeskShell(input: {
  email: string;
  displayName: string;
}): Promise<DeskShell | { denied: true }> {
  const email = input.email.trim().toLowerCase();
  const hit = globalForDesk.setoDesk;
  const { shopifyIsConnected } = await import("./shopify-oauth");

  async function liveApiCount() {
    const status = integrationStatus();
    const shopify = await shopifyIsConnected();
    let meta = false;
    try {
      const health = await import("./meta-health").then((m) => m.getMetaHealth(false));
      meta = health.live;
    } catch {
      meta = false;
    }
    return Object.values({ ...status.liveApis, shopify, meta }).filter(Boolean).length;
  }

  if (hit && hit.email === email && Date.now() - hit.at < TTL_MS) {
    return {
      ...hit.shell,
      storeSlug: hit.shell.storeSlug || "seto",
      storeHref: hit.shell.storeHref || storeHomePath(hit.shell.storeSlug || "seto"),
      liveCount: await liveApiCount(),
      stripeMode: hit.shell.stripeMode ?? stripeCheckoutMode(""),
      stripePkMasked: hit.shell.stripePkMasked ?? "",
      stripeSkMasked: hit.shell.stripeSkMasked ?? "",
    };
  }

  const db = await ensureDb();
  try {
    await provisionOperator(db, {
      email,
      displayName: input.displayName,
    });
  } catch {
    /* Existing row or a later lookup is enough. */
  }

  const [sessionUser, billing] = await Promise.all([getOperator(), getBillingSummary()]);
  const user = sessionUser ?? (await getUserByEmail(email));
  if (!user) return { denied: true };

  const slug = user.storeSlug?.trim() || "seto";
  const shell: DeskShell = {
    storeName: user.storeName,
    displayName: user.displayName,
    storeSlug: slug,
    storeHref: storeHomePath(slug),
    billing,
    liveCount: await liveApiCount(),
    stripeMode: stripeCheckoutMode(user.storeStripeSk),
    stripePkMasked: maskStripeKey(user.storeStripePk),
    stripeSkMasked: maskStripeKey(user.storeStripeSk),
  };
  globalForDesk.setoDesk = { email, at: Date.now(), shell };
  return shell;
}
