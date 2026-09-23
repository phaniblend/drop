import { eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { isSuperuser } from "../superuser";
import { LOW_STOCK_THRESHOLD } from "../stock-threshold";
import { nowIso, todayKey } from "../utils";
import { extractAliExpressProductId } from "../aliexpress-url";
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
  await archiveDuplicateDrafts(db);
  await maybeRepairCatalog(db);
}

async function maybeRepairCatalog(db: DB) {
  const [flag] = await db
    .select()
    .from(schema.settings)
    .where(eq(schema.settings.key, "catalog_repair_v3"))
    .limit(1);
  if (flag) return;
  const { repairCatalogData } = await import("./repair-catalog");
  await repairCatalogData(db);
}

export async function archiveDuplicateDrafts(db: DB) {
  const [flag] = await db
    .select()
    .from(schema.settings)
    .where(eq(schema.settings.key, "deduped_listings_v1"))
    .limit(1);
  if (flag) return;
  const rows = await db.select().from(schema.products);
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const listingId = extractAliExpressProductId(row.supplierUrl);
    if (!listingId) continue;
    const list = groups.get(listingId) ?? [];
    list.push(row);
    groups.set(listingId, list);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const published = group.filter((p) => p.status === "published");
    const keep =
      published.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ??
      group.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    for (const extra of group) {
      if (extra.id === keep.id || extra.status === "published") continue;
      await db.update(schema.products).set({ status: "archived" }).where(eq(schema.products.id, extra.id));
    }
  }
  try {
    await db.insert(schema.settings).values({ key: "deduped_listings_v1", value: "1" });
  } catch {
    /* already marked */
  }
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
    const claimable =
      op.email === PLACEHOLDER_EMAIL || op.email === DEMO_EMAIL || isSuperuser(email);
    if (!claimable) return { ok: false, reason: "desk_claimed" };
    await db
      .update(schema.users)
      .set({ email, displayName })
      .where(eq(schema.users.id, op.id));
    return { ok: true, id: op.id };
  }
  if (displayName && displayName !== op.displayName) {
    await db.update(schema.users).set({ displayName }).where(eq(schema.users.id, op.id));
  }
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

const globalForTasks = globalThis as unknown as { setoTasksDate?: string };

async function rotateDailyTasks(db: DB) {
  const today = todayKey();
  if (globalForTasks.setoTasksDate === today) return;
  const [row] = await db
    .select({ forDate: schema.dailyTasks.forDate })
    .from(schema.dailyTasks)
    .limit(1);
  if (row?.forDate === today) {
    globalForTasks.setoTasksDate = today;
    return;
  }
  await db.delete(schema.dailyTasks);
  await db.insert(schema.dailyTasks).values(taskRows(today));
  globalForTasks.setoTasksDate = today;
}

function taskRows(forDate: string) {
  return [
    {
      id: "task_orders",
      title: "Ship today's waiting orders",
      detail: "Buy from the supplier for anything waiting more than 4 hours.",
      done: false,
      sortOrder: 1,
      forDate,
    },
    {
      id: "task_tracking",
      title: "Push tracking numbers",
      detail: "Paste tracking for orders you already paid the supplier for.",
      done: false,
      sortOrder: 2,
      forDate,
    },
    {
      id: "task_cs",
      title: "Answer “where’s my order?” messages",
      detail: "Use saved replies. Start with orders shipped more than 12 days ago.",
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
      detail: `Pause ads if a bestseller has fewer than ${LOW_STOCK_THRESHOLD} left.`,
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
