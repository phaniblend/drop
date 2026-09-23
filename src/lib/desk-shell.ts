import "server-only";

import { integrationStatus } from "./env";
import { ensureDb } from "./db";
import { getOperator } from "./db/queries";
import { provisionOperator } from "./db/seed";
import { getBillingSummary, type BillingSummary } from "./billing";

export type DeskShell = {
  storeName: string;
  displayName: string;
  billing: BillingSummary;
  liveCount: number;
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
    const shopify = (await shopifyIsConnected()) || status.shopify;
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
    return { ...hit.shell, liveCount: await liveApiCount() };
  }

  const db = await ensureDb();
  const claimed = await provisionOperator(db, {
    email,
    displayName: input.displayName,
  });
  if (!claimed.ok) return { denied: true };

  const [user, billing] = await Promise.all([getOperator(), getBillingSummary()]);
  if (!user) return { denied: true };

  const shell: DeskShell = {
    storeName: user.storeName,
    displayName: user.displayName,
    billing,
    liveCount: await liveApiCount(),
  };
  globalForDesk.setoDesk = { email, at: Date.now(), shell };
  return shell;
}
