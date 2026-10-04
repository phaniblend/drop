import "server-only";

import { and, eq } from "drizzle-orm";
import { ensureDb } from "./db";
import { campaignTrackers, coachSessions, orderItems, orders, products } from "./db/schema";
import { findProductBySupplierUrl, getOperator, getProduct } from "./db/queries";
import { nid, nowIso, todayKey } from "./utils";
import { isSampleCampaignId } from "./sample-campaigns";
import { suggestWinningKeyword } from "./coach-keyword";
import {
  evaluateShare,
  instructionFor,
  nextCoachStep,
  normalizeCoachStep,
  openingMessages,
  youSaid,
  type CoachFacts,
  type CoachMessage,
  type CoachPick,
  type CoachStepId,
} from "./coach-plan";

function parseMessages(raw: string): CoachMessage[] {
  try {
    const v = JSON.parse(raw) as CoachMessage[];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function parsePick(raw: string): CoachPick | null {
  try {
    const v = JSON.parse(raw) as CoachPick;
    if (v && typeof v.url === "string" && v.url) return v;
  } catch {
    /* empty */
  }
  return null;
}

function publicSession(row: typeof coachSessions.$inferSelect) {
  return {
    id: row.id,
    dateLocal: row.dateLocal,
    stepId: normalizeCoachStep(row.stepId),
    keyword: row.keyword,
    keywordWhy: row.keywordWhy,
    pick: parsePick(row.pickJson),
    catalogProductId: row.catalogProductId,
    messages: parseMessages(row.messagesJson),
  };
}

async function requireOperator() {
  const operator = await getOperator();
  if (!operator) throw new Error("Sign in first.");
  return operator;
}

async function loadToday() {
  const operator = await requireOperator();
  const db = await ensureDb();
  const dateLocal = todayKey(operator.timezone || "America/Chicago");
  const [row] = await db
    .select()
    .from(coachSessions)
    .where(and(eq(coachSessions.userId, operator.id), eq(coachSessions.dateLocal, dateLocal)))
    .limit(1);
  return { operator, db, dateLocal, row };
}

function append(messages: CoachMessage[], extra: CoachMessage[]) {
  const stamp = Date.now().toString(36);
  return [
    ...messages,
    ...extra.map((m, i) => ({
      ...m,
      id: `${m.id}_${stamp}_${i}`,
    })),
  ];
}

async function collectFacts(
  operatorId: string,
  pick: CoachPick | null,
  catalogProductId: string | null,
): Promise<{ facts: CoachFacts; productId: string | null; title: string | null }> {
  const db = await ensureDb();
  type Row = { id: string; status: string; cleanTitle: string | null; rawTitle: string; supplierUrl: string };
  let product: Row | null = catalogProductId ? await getProduct(catalogProductId) : null;
  if (!product && pick?.url) {
    product = await findProductBySupplierUrl(pick.url);
  }
  if (!product && pick?.url) {
    const catalog = await db.select().from(products).where(eq(products.userId, operatorId));
    product =
      catalog.find((p) => p.supplierUrl === pick.url || (pick.url && p.supplierUrl?.includes(pick.url))) ?? null;
  }
  const productId = product?.id ?? null;
  const published = Boolean(
    product && (product.status === "published" || product.status === "live" || product.status === "local_only"),
  );

  const live = productId
    ? (await db.select().from(campaignTrackers).where(eq(campaignTrackers.productId, productId))).filter(
        (c) => !isSampleCampaignId(c.id),
      )
    : [];
  const adLinked = live.length > 0;
  const adPausedLoser = live.some(
    (c) =>
      c.isPaused &&
      (c.pauseSource === "margin_guard" || c.pauseSource === "guard" || c.pauseSource === "sentinel" || c.spendToday > 0),
  );
  const adWinning = live.some((c) => !c.isPaused && c.revenueToday > c.spendToday && c.ordersCount > 0);

  let hasCheckout = false;
  let orderPlaced = false;
  if (productId) {
    const lines = await db.select().from(orderItems).where(eq(orderItems.productId, productId));
    const orderIds = [...new Set(lines.map((l) => l.orderId).filter(Boolean))] as string[];
    if (orderIds.length) {
      const rows = await db.select().from(orders).where(eq(orders.userId, operatorId));
      const mine = rows.filter((o) => orderIds.includes(o.id));
      hasCheckout = mine.length > 0;
      orderPlaced = mine.some(
        (o) => o.fulfillmentStatus === "ordered_supplier" || o.fulfillmentStatus === "shipped",
      );
    }
  }

  return {
    facts: {
      imported: Boolean(product),
      published,
      adLinked,
      adPausedLoser,
      adWinning,
      hasCheckout,
      orderPlaced,
    },
    productId,
    title: product?.cleanTitle || product?.rawTitle || pick?.title || null,
  };
}

export async function getOrCreateCoachSession() {
  const { operator, db, dateLocal, row } = await loadToday();
  if (row) return publicSession(row);
  const suggestion = await suggestWinningKeyword(dateLocal);
  const created = {
    id: nid("coach"),
    userId: operator.id,
    dateLocal,
    stepId: "pick" as CoachStepId,
    keyword: suggestion.keyword,
    keywordWhy: suggestion.why,
    pickJson: "{}",
    catalogProductId: null as string | null,
    messagesJson: JSON.stringify(openingMessages(suggestion.keyword, suggestion.why)),
    updatedAt: nowIso(),
    createdAt: nowIso(),
  };
  await db.insert(coachSessions).values(created);
  return publicSession(created);
}

export async function submitCoachPick(pick: CoachPick) {
  const { db, row } = await loadToday();
  if (!row) throw new Error("Start today’s plan first.");
  const step = normalizeCoachStep(row.stepId);
  if (step !== "pick") return publicSession(row);
  const url = pick.url.trim();
  if (!url) throw new Error("That listing has no supplier link.");
  const nextId = nextCoachStep("pick");
  const title = pick.title || url;
  const messages = append(parseMessages(row.messagesJson), [
    { id: "y", role: "you", text: youSaid("pick", title) },
    { id: "s", role: "seto", text: instructionFor(nextId, { title }) },
  ]);
  await db
    .update(coachSessions)
    .set({
      stepId: nextId,
      pickJson: JSON.stringify({ ...pick, url }),
      messagesJson: JSON.stringify(messages),
      updatedAt: nowIso(),
    })
    .where(eq(coachSessions.id, row.id));
  const [next] = await db.select().from(coachSessions).where(eq(coachSessions.id, row.id)).limit(1);
  return publicSession(next ?? row);
}

export async function confirmCoachStep() {
  const { operator, db, row } = await loadToday();
  if (!row) throw new Error("Start today’s plan first.");
  const step = normalizeCoachStep(row.stepId);
  if (step === "pick") throw new Error("Share a listing first. I’ll wait.");
  if (step === "done") return { session: publicSession(row) };

  const pick = parsePick(row.pickJson);
  const gathered = await collectFacts(operator.id, pick, row.catalogProductId);
  const gate = evaluateShare(step, gathered.facts);
  if (!gate.ok) {
    const messages = append(parseMessages(row.messagesJson), [{ id: "w", role: "seto", text: gate.wait }]);
    await db
      .update(coachSessions)
      .set({
        stepId: step,
        catalogProductId: gathered.productId,
        messagesJson: JSON.stringify(messages),
        updatedAt: nowIso(),
      })
      .where(eq(coachSessions.id, row.id));
    const [again] = await db.select().from(coachSessions).where(eq(coachSessions.id, row.id)).limit(1);
    return { session: publicSession(again ?? row), blocked: true };
  }

  const next = nextCoachStep(step);
  const title = gathered.title || pick?.title;
  const messages = append(parseMessages(row.messagesJson), [
    { id: "y", role: "you", text: youSaid(step, title, gathered.facts) },
    { id: "s", role: "seto", text: instructionFor(next, { title: title ?? undefined }) },
  ]);
  await db
    .update(coachSessions)
    .set({
      stepId: next,
      catalogProductId: gathered.productId,
      messagesJson: JSON.stringify(messages),
      updatedAt: nowIso(),
    })
    .where(eq(coachSessions.id, row.id));
  const [fresh] = await db.select().from(coachSessions).where(eq(coachSessions.id, row.id)).limit(1);
  return { session: publicSession(fresh ?? row) };
}

export async function restartCoachToday() {
  const { db, row } = await loadToday();
  if (row) {
    await db.delete(coachSessions).where(eq(coachSessions.id, row.id));
  }
  return getOrCreateCoachSession();
}

export type PublicCoachSession = Awaited<ReturnType<typeof getOrCreateCoachSession>>;
