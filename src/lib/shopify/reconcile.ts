import { eq } from "drizzle-orm";
import { jobRuns, shopifyConnections } from "../db/schema-guard";
import { decryptSecret } from "../crypto";
import { nid, nowIso } from "../utils";
import { shopifyApiHost, syncOrder, type FetchOrder } from "./sync-order";

type Db = Awaited<ReturnType<typeof import("../db").ensureDb>>;

const ORDERS_UPDATED_SINCE = `
query OrdersUpdated($query: String!, $cursor: String) {
  orders(first: 50, query: $query, after: $cursor, sortKey: UPDATED_AT) {
    pageInfo { hasNextPage endCursor }
    nodes { id updatedAt }
  }
}
`;

export async function fetchUpdatedOrderIds(
  shopDomain: string,
  token: string,
  sinceIso: string,
): Promise<string[]> {
  const ids: string[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 20; page += 1) {
    const res = await fetch(`https://${shopifyApiHost(shopDomain)}/admin/api/2026-07/graphql.json`, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: ORDERS_UPDATED_SINCE,
        variables: {
          query: `updated_at:>='${sinceIso}'`,
          cursor,
        },
      }),
    });
    if (!res.ok) throw new Error(`Shopify reconcile failed (${res.status}).`);
    const json = (await res.json()) as {
      data?: {
        orders?: {
          pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
          nodes?: Array<{ id: string }>;
        };
      };
    };
    const nodes = json.data?.orders?.nodes ?? [];
    for (const node of nodes) ids.push(node.id);
    if (!json.data?.orders?.pageInfo?.hasNextPage) break;
    cursor = json.data?.orders?.pageInfo?.endCursor ?? null;
    if (!cursor) break;
  }
  return ids;
}

function sinceFor(lastReconciledAt: string | null | undefined) {
  const base = lastReconciledAt
    ? Date.parse(lastReconciledAt)
    : Date.now() - 7 * 24 * 3600_000;
  return new Date(base - 2 * 3600_000).toISOString();
}

export async function reconcileShop(
  connectionId: string,
  opts: {
    db: Db;
    fetchOrderIds?: typeof fetchUpdatedOrderIds;
    fetchOrder?: FetchOrder;
  },
) {
  const [shop] = await opts.db
    .select()
    .from(shopifyConnections)
    .where(eq(shopifyConnections.id, connectionId))
    .limit(1);
  if (!shop || shop.status !== "ACTIVE") return { ok: false, synced: 0, reason: "inactive" };

  const jobId = nid("job");
  const startedAt = nowIso();
  await opts.db.insert(jobRuns).values({
    id: jobId,
    job: "shopify.reconcile",
    scopeKey: shop.storeId,
    startedAt,
  });

  try {
    const token = decryptSecret(shop.accessTokenEnc);
    const since = sinceFor(shop.lastReconciledAt);
    const fetchIds = opts.fetchOrderIds ?? fetchUpdatedOrderIds;
    const ids = await fetchIds(shop.shopDomain, token, since);
    let synced = 0;
    for (const id of ids) {
      const result = await syncOrder(shop.shopDomain, id, {
        db: opts.db,
        fetchOrder: opts.fetchOrder,
      });
      if (!result.skipped) synced += 1;
    }
    const finishedAt = nowIso();
    await opts.db
      .update(shopifyConnections)
      .set({ lastReconciledAt: finishedAt, updatedAt: finishedAt })
      .where(eq(shopifyConnections.id, shop.id));
    await opts.db
      .update(jobRuns)
      .set({ finishedAt, ok: true, statsJson: JSON.stringify({ synced, scanned: ids.length, since }) })
      .where(eq(jobRuns.id, jobId));
    return { ok: true, synced, scanned: ids.length };
  } catch (error) {
    await opts.db
      .update(jobRuns)
      .set({
        finishedAt: nowIso(),
        ok: false,
        error: error instanceof Error ? error.message : "reconcile failed",
      })
      .where(eq(jobRuns.id, jobId));
    return { ok: false, synced: 0, reason: "error" };
  }
}

export async function reconcileAllActiveShops(db: Db) {
  const shops = await db
    .select({ id: shopifyConnections.id })
    .from(shopifyConnections)
    .where(eq(shopifyConnections.status, "ACTIVE"));
  const results = [];
  for (const shop of shops) {
    results.push(await reconcileShop(shop.id, { db }));
  }
  return results;
}

/** Data-health gate: reconcile older than 2h blocks the guard for that store. */
export function reconcileIsStale(lastReconciledAt: string | null | undefined, now = Date.now()) {
  if (!lastReconciledAt) return true;
  return now - Date.parse(lastReconciledAt) > 2 * 3600_000;
}
