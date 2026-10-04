import "server-only";

import { and, eq } from "drizzle-orm";
import { ensureDb } from "./db";
import { coachSessions } from "./db/schema";
import { getOperator, getProduct } from "./db/queries";
import { nid, nowIso, todayKey } from "./utils";
import { suggestWinningKeyword } from "./coach-keyword";
import {
  afterImportMessages,
  afterPickMessages,
  nextCoachStep,
  openingMessages,
  promptForStep,
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
    stepId: row.stepId as CoachStepId,
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
  if (row.stepId !== "pick") {
    return publicSession(row);
  }
  const url = pick.url.trim();
  if (!url) throw new Error("That listing has no supplier link.");
  const messages = append(parseMessages(row.messagesJson), afterPickMessages({ ...pick, url }));
  await db
    .update(coachSessions)
    .set({
      stepId: "import",
      pickJson: JSON.stringify({ ...pick, url }),
      messagesJson: JSON.stringify(messages),
      updatedAt: nowIso(),
    })
    .where(eq(coachSessions.id, row.id));
  const [next] = await db.select().from(coachSessions).where(eq(coachSessions.id, row.id)).limit(1);
  return publicSession(next ?? row);
}

export async function importCoachPick() {
  const { db, row } = await loadToday();
  if (!row) throw new Error("Start today’s plan first.");
  const pick = parsePick(row.pickJson);
  if (!pick?.url) throw new Error("Share a listing first.");
  const { importFromSupplierUrl, importLiveListing } = await import("@/app/actions/products");
  const feed = {
    id: pick.url,
    title: pick.title,
    cleanTitle: pick.title,
    url: pick.url,
    source: (pick.source === "cj" ? "cj" : "aliexpress") as "aliexpress" | "cj",
    supplierName: pick.source === "cj" ? "CJ Dropshipping" : "AliExpress",
    niche: "",
    cost: pick.cost || 0,
    shipping: 0,
    shippingDays: 0,
    stock: 0,
    demand: 0,
    live: true as const,
    image: pick.image || "",
    tags: [] as string[],
    variants: [] as Array<{ skuId: string; attributes: string; cost: number; stock: number }>,
  };
  let imported: { id?: string; paywall?: unknown };
  try {
    imported = await importLiveListing(feed);
  } catch {
    imported = await importFromSupplierUrl(pick.url);
  }
  if ("paywall" in imported && imported.paywall) {
    return { paywall: imported.paywall, session: publicSession(row) };
  }
  const productId = imported.id;
  if (!productId) throw new Error("Import did not return a product.");
  const product = await getProduct(productId);
  const title = product?.cleanTitle || pick.title;
  const messages = append(parseMessages(row.messagesJson), [
    { id: "yi", role: "you", text: "Imported the listing." },
    ...afterImportMessages(title),
  ]);
  await db
    .update(coachSessions)
    .set({
      stepId: "clean",
      catalogProductId: productId,
      messagesJson: JSON.stringify(messages),
      updatedAt: nowIso(),
    })
    .where(eq(coachSessions.id, row.id));
  const [next] = await db.select().from(coachSessions).where(eq(coachSessions.id, row.id)).limit(1);
  return { session: publicSession(next ?? row) };
}

export async function confirmCoachStep() {
  const { db, row } = await loadToday();
  if (!row) throw new Error("Start today’s plan first.");
  const step = row.stepId as CoachStepId;
  if (step === "pick") throw new Error("Share a listing first.");
  if (step === "import") return importCoachPick();

  const productId = row.catalogProductId;
  const product = productId ? await getProduct(productId) : null;
  const pick = parsePick(row.pickJson);

  if (step === "publish") {
    if (!product || (product.status !== "published" && product.status !== "live" && product.status !== "local_only")) {
      const messages = append(parseMessages(row.messagesJson), [
        {
          id: "wait",
          role: "seto",
          text: "I don’t see it live yet. Open the listing, click Publish, then tap I published it again.",
        },
      ]);
      await db
        .update(coachSessions)
        .set({ messagesJson: JSON.stringify(messages), updatedAt: nowIso() })
        .where(eq(coachSessions.id, row.id));
      const [again] = await db.select().from(coachSessions).where(eq(coachSessions.id, row.id)).limit(1);
      return { session: publicSession(again ?? row), blocked: true };
    }
  }

  if (step === "angles") {
    let hooks = 0;
    try {
      hooks = product?.adAnglesJson ? JSON.parse(product.adAnglesJson).length : 0;
    } catch {
      hooks = 0;
    }
    if (hooks < 1) {
      const messages = append(parseMessages(row.messagesJson), [
        {
          id: "wait",
          role: "seto",
          text: "No ad angles yet. Open the listing, generate angles, then tap I’m done.",
        },
      ]);
      await db
        .update(coachSessions)
        .set({ messagesJson: JSON.stringify(messages), updatedAt: nowIso() })
        .where(eq(coachSessions.id, row.id));
      const [again] = await db.select().from(coachSessions).where(eq(coachSessions.id, row.id)).limit(1);
      return { session: publicSession(again ?? row), blocked: true };
    }
  }

  const next = nextCoachStep(step);
  const youLabel =
    step === "clean"
      ? "Title looks good."
      : step === "publish"
        ? "Published."
        : step === "angles"
          ? "Ad angles are in."
          : "Test is live.";
  const setoText = promptForStep(next, product?.cleanTitle || pick?.title);
  const messages = append(parseMessages(row.messagesJson), [
    { id: "y", role: "you", text: youLabel },
    { id: "s", role: "seto", text: setoText },
  ]);
  await db
    .update(coachSessions)
    .set({
      stepId: next,
      messagesJson: JSON.stringify(messages),
      updatedAt: nowIso(),
    })
    .where(eq(coachSessions.id, row.id));
  const [fresh] = await db.select().from(coachSessions).where(eq(coachSessions.id, row.id)).limit(1);
  return { session: publicSession(fresh ?? row) };
}

export async function restartCoachToday() {
  const { db, dateLocal, row } = await loadToday();
  if (row) {
    await db.delete(coachSessions).where(eq(coachSessions.id, row.id));
  }
  void dateLocal;
  return getOrCreateCoachSession();
}

export type PublicCoachSession = Awaited<ReturnType<typeof getOrCreateCoachSession>>;
