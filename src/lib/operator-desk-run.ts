import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { ensureDb } from "./db";
import { campaignTrackers, dailyDirectives, orders, products, users } from "./db/schema";
import { netProfit } from "./money";
import { round2 } from "./utils";
import { buildDailyDirective, type DeskSignals } from "./operator-desk";
import { nid, nowIso, todayKey } from "./utils";
import { isSampleCampaignId } from "./sample-campaigns";
import { getOperator } from "./db/queries";

function consecutiveProfitDays(rows: Array<{ createdAt: string; netMargin: number }>, tz: string) {
  const byDay = new Map<string, number>();
  for (const o of rows) {
    const key = todayKey(tz, o.createdAt);
    byDay.set(key, (byDay.get(key) ?? 0) + o.netMargin);
  }
  let n = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = todayKey(tz, d.toISOString());
    const net = byDay.get(key) ?? 0;
    if (net > 25) n += 1;
    else break;
  }
  return n;
}

export async function collectDeskSignals(userId: string, tz: string): Promise<DeskSignals> {
  const db = await ensureDb();
  const [campaigns, catalog, orderRows] = await Promise.all([
    db.select().from(campaignTrackers),
    db.select().from(products).where(eq(products.userId, userId)),
    db.select().from(orders).where(eq(orders.userId, userId)),
  ]);
  const catalogIds = new Set(catalog.map((p) => p.id));
  const live = campaigns.filter(
    (c) => !isSampleCampaignId(c.id) && Boolean(c.productId) && catalogIds.has(c.productId!),
  );
  const spendToday = live.reduce((s, c) => s + (c.spendToday || 0), 0);
  const floors = live.map((c) => c.spendLimitThreshold).filter((n) => n > 0);
  const spendFloor = floors.length ? Math.min(...floors) : 35;
  const spendCap = floors.length ? Math.min(5000, floors.reduce((s, n) => s + n, 0) * 10) : 500;
  const netBest = live.reduce((best, c) => {
    const product = c.productId ? catalog.find((p) => p.id === c.productId) : undefined;
    const cogsToday = product
      ? round2((product.baseCost + product.shippingCost) * c.ordersCount)
      : round2(c.revenueToday * 0.35);
    const profit = netProfit({ revenue: c.revenueToday, cogs: cogsToday, adSpend: c.spendToday });
    return Math.max(best, profit);
  }, 0);
  const paused = live.find(
    (c) =>
      c.isPaused &&
      (c.pauseSource === "margin_guard" || c.pauseSource === "guard" || c.pauseSource === "sentinel"),
  );
  const linked = new Set(live.map((c) => c.productId).filter(Boolean));
  const ready = catalog.filter((p) => p.status === "published" || p.status === "ready");
  const staging = ready.filter((p) => !linked.has(p.id));
  const pendingHooks = catalog.filter((p) => {
    try {
      return !p.adAnglesJson || JSON.parse(p.adAnglesJson).length === 0;
    } catch {
      return true;
    }
  }).length;
  const testing = live.find((c) => !c.isPaused) || live[0];
  const testingProduct = testing?.productId ? catalog.find((p) => p.id === testing.productId) : undefined;
  const pausedProduct = paused?.productId ? catalog.find((p) => p.id === paused.productId) : undefined;
  const hero = testingProduct || catalog.find((p) => p.status === "published") || catalog[0];

  return {
    spendToday,
    spendFloor,
    spendCap,
    netBest,
    consecutiveProfitDays: consecutiveProfitDays(orderRows, tz),
    pausedOvernight: Boolean(paused),
    pausedName: pausedProduct?.cleanTitle || paused?.adSetName || pausedProduct?.rawTitle,
    capitalSaved: paused
      ? Math.max(0, (paused.spendLimitThreshold || spendFloor) - (paused.spendToday || 0))
      : 0,
    stagingCount: staging.length || ready.length,
    pendingHooks,
    testingName: testingProduct?.cleanTitle || testing?.adSetName,
    productTitle: hero?.cleanTitle || hero?.rawTitle || null,
  };
}

async function persistDirective(userId: string, tz: string) {
  const db = await ensureDb();
  const dateLocal = todayKey(tz);
  const [existing] = await db
    .select()
    .from(dailyDirectives)
    .where(and(eq(dailyDirectives.userId, userId), eq(dailyDirectives.dateLocal, dateLocal)))
    .limit(1);
  if (existing) return { row: existing, created: false };

  const signals = await collectDeskSignals(userId, tz);
  const built = buildDailyDirective(signals);
  const row = {
    id: nid("dir"),
    userId,
    dateLocal,
    stage: built.stage,
    headline: built.headline,
    body: built.body,
    actionType: built.actionType,
    actionHref: built.actionHref,
    actionLabel: built.actionLabel,
    actionPayload: JSON.stringify({
      stagingCount: signals.stagingCount,
      pendingHooks: signals.pendingHooks,
    }),
    spendToday: signals.spendToday,
    spendCap: signals.spendCap,
    completed: false,
    completedAt: null as string | null,
    evaluationId: null as string | null,
    createdAt: nowIso(),
  };
  try {
    await db.insert(dailyDirectives).values(row);
    return { row, created: true };
  } catch {
    const [again] = await db
      .select()
      .from(dailyDirectives)
      .where(and(eq(dailyDirectives.userId, userId), eq(dailyDirectives.dateLocal, dateLocal)))
      .limit(1);
    return { row: again ?? row, created: false };
  }
}

export async function getOrCreateTodayDirective() {
  const operator = await getOperator();
  if (!operator) return null;
  const { row } = await persistDirective(operator.id, operator.timezone || "America/Chicago");
  return row;
}

export async function generateDirectivesForAllOperators() {
  const db = await ensureDb();
  const ops = await db.select({ id: users.id, timezone: users.timezone }).from(users);
  let created = 0;
  for (const op of ops) {
    const res = await persistDirective(op.id, op.timezone || "America/Chicago");
    if (res.created) created += 1;
  }
  return { operators: ops.length, created };
}

export async function markDirectiveDone(id: string, completed: boolean) {
  const operator = await getOperator();
  if (!operator) throw new Error("Sign in first.");
  const db = await ensureDb();
  const [row] = await db.select().from(dailyDirectives).where(eq(dailyDirectives.id, id)).limit(1);
  if (!row || row.userId !== operator.id) throw new Error("Directive not found.");
  await db
    .update(dailyDirectives)
    .set({
      completed,
      completedAt: completed ? nowIso() : null,
    })
    .where(eq(dailyDirectives.id, id));
  return { ok: true as const };
}

export async function latestDirectiveForOperator() {
  const operator = await getOperator();
  if (!operator) return null;
  const db = await ensureDb();
  const dateLocal = todayKey(operator.timezone || "America/Chicago");
  const [today] = await db
    .select()
    .from(dailyDirectives)
    .where(and(eq(dailyDirectives.userId, operator.id), eq(dailyDirectives.dateLocal, dateLocal)))
    .limit(1);
  if (today) return today;
  const [row] = await db
    .select()
    .from(dailyDirectives)
    .where(eq(dailyDirectives.userId, operator.id))
    .orderBy(desc(dailyDirectives.createdAt))
    .limit(1);
  return row ?? null;
}
