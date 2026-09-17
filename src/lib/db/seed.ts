import { eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { nowIso, todayKey } from "../utils";
import * as schema from "./schema";

type DB = LibSQLDatabase<typeof schema>;

const DEMO_USER_ID = "usr_demo_operator";
const DEMO_EMAIL = "operator@dropshipos.local";
const PLACEHOLDER_EMAIL = "pending@setostore.local";

export async function seedIfEmpty(db: DB) {
  await wipeDemoIfPresent(db);
  const existing = await db.select({ id: schema.users.id }).from(schema.users).limit(1);
  if (existing.length === 0) return;
  await rotateDailyTasks(db);
}

export async function wipeDemoIfPresent(db: DB) {
  const [byId] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.id, DEMO_USER_ID)).limit(1);
  const [byEmail] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, DEMO_EMAIL))
    .limit(1);
  const [flag] = await db
    .select()
    .from(schema.settings)
    .where(eq(schema.settings.key, "demo_mode"))
    .limit(1);
  if (!byId && !byEmail && !flag) return;
  await wipeOperationalData(db);
}

export async function wipeOperationalData(db: DB) {
  await db.delete(schema.activityLog);
  await db.delete(schema.refunds);
  await db.delete(schema.dailyTasks);
  await db.delete(schema.csMacros);
  await db.delete(schema.orderItems);
  await db.delete(schema.orders);
  await db.delete(schema.campaignTrackers);
  await db.delete(schema.productVariants);
  await db.delete(schema.products);
  await db.delete(schema.suppliers);
  await db.delete(schema.settings);
  await db.delete(schema.users);
}

export async function clearWorkspaceKeepOperator(db: DB) {
  await db.delete(schema.activityLog);
  await db.delete(schema.refunds);
  await db.delete(schema.orderItems);
  await db.delete(schema.orders);
  await db.delete(schema.campaignTrackers);
  await db.delete(schema.productVariants);
  await db.delete(schema.products);
  await db.delete(schema.suppliers);
  await db.delete(schema.dailyTasks);
  await db.insert(schema.dailyTasks).values(taskRows(todayKey()));
}

export async function provisionOperator(
  db: DB,
  input: { email: string; displayName: string },
): Promise<{ ok: true; id: string } | { ok: false; reason: "desk_claimed" }> {
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim() || "Operator";
  const existing = await db.select().from(schema.users).limit(1);
  const op = existing[0];
  if (!op) {
    const id = `usr_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
    await db.insert(schema.users).values({
      id,
      email,
      displayName,
      storeName: "SetoStore",
      createdAt: nowIso(),
    });
    await seedOperatorWorkspace(db);
    return { ok: true, id };
  }
  if (op.email.toLowerCase() !== email) {
    const claimable = op.email === PLACEHOLDER_EMAIL || op.email === DEMO_EMAIL;
    if (!claimable) return { ok: false, reason: "desk_claimed" };
    await db
      .update(schema.users)
      .set({ email, displayName })
      .where(eq(schema.users.id, op.id));
    await rotateDailyTasks(db);
    return { ok: true, id: op.id };
  }
  if (displayName && displayName !== op.displayName) {
    await db.update(schema.users).set({ displayName }).where(eq(schema.users.id, op.id));
  }
  await rotateDailyTasks(db);
  return { ok: true, id: op.id };
}

async function seedOperatorWorkspace(db: DB) {
  const macros = await db.select({ id: schema.csMacros.id }).from(schema.csMacros).limit(1);
  if (macros.length === 0) {
    await db.insert(schema.csMacros).values([
      {
        id: "mac_wismo",
        category: "shipping",
        title: "Where is my order?",
        body: "Hi {{name}}, thanks for reaching out — your order {{order}} is in fulfillment. Tracking is {{tracking}}. Typical delivery is 8–16 days from the ship date. I'll send an update the moment the carrier scans it again.",
      },
      {
        id: "mac_delay",
        category: "shipping",
        title: "Shipping delay",
        body: "Hi {{name}}, your parcel {{tracking}} is moving slower than usual through customs. This is still in transit and has not been returned. If it has not updated in 5 more days I will reship or refund — your choice.",
      },
      {
        id: "mac_tracking",
        category: "shipping",
        title: "Tracking uploaded",
        body: "Hi {{name}}, tracking for {{order}} is live: {{tracking}} ({{carrier}}). Give it 24h to populate on the carrier site. Thanks for your patience!",
      },
      {
        id: "mac_refund",
        category: "refunds",
        title: "Refund issued",
        body: "Hi {{name}}, refund for {{order}} is on the way. Card refunds post in 3–7 days depending on the bank. Sorry for the hassle — if you still want the product I can reship immediately.",
      },
      {
        id: "mac_wrong",
        category: "quality",
        title: "Wrong / damaged item",
        body: "Hi {{name}}, sorry about that. Send a quick photo of what arrived and I will either reship the correct item today or refund {{order}} in full. No need to return anything.",
      },
      {
        id: "mac_pre",
        category: "pre-sale",
        title: "Shipping time (pre-sale)",
        body: "Hi! We ship within 1 business day. Delivery is typically 8–16 days to the US with full tracking. If it exceeds the window we reship or refund — no hoop-jumping.",
      },
    ]);
  }
  await rotateDailyTasks(db);
}

async function rotateDailyTasks(db: DB) {
  const today = todayKey();
  const rows = await db.select().from(schema.dailyTasks).limit(1);
  if (rows[0] && rows[0].forDate === today) return;
  await db.delete(schema.dailyTasks);
  await db.insert(schema.dailyTasks).values(taskRows(today));
}

function taskRows(forDate: string) {
  return [
    {
      id: "task_orders",
      title: "Clear the unfulfilled queue",
      detail: "Place supplier orders for everything older than 4 hours.",
      done: false,
      sortOrder: 1,
      forDate,
    },
    {
      id: "task_tracking",
      title: "Push tracking numbers",
      detail: "Paste tracking for anything marked ordered_supplier.",
      done: false,
      sortOrder: 2,
      forDate,
    },
    {
      id: "task_cs",
      title: "Answer WISMO tickets",
      detail: "Use macros. Prioritize orders shipped > 12 days ago.",
      done: false,
      sortOrder: 3,
      forDate,
    },
    {
      id: "task_ads",
      title: "Run Margin Guard",
      detail: "Kill any ad set past spend cap with negative net profit.",
      done: false,
      sortOrder: 4,
      forDate,
    },
    {
      id: "task_stock",
      title: "Check supplier stock on winners",
      detail: "Pause ads if a hero SKU drops under 30 units.",
      done: false,
      sortOrder: 5,
      forDate,
    },
    {
      id: "task_research",
      title: "Queue 3 new tests",
      detail: "Import from Discover. Keep creative-ready titles only.",
      done: false,
      sortOrder: 6,
      forDate,
    },
  ];
}

export async function logActivity(
  db: DB,
  input: { kind: string; message: string; href?: string },
) {
  await db.insert(schema.activityLog).values({
    id: `act_${crypto.randomUUID().slice(0, 10)}`,
    kind: input.kind,
    message: input.message,
    href: input.href ?? null,
    createdAt: nowIso(),
  });
}
