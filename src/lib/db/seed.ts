import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { netProfit, processorFee, suggestedRetail } from "../money";
import { nowIso, todayKey } from "../utils";
import * as schema from "./schema";

type DB = LibSQLDatabase<typeof schema>;

export const DEMO_USER_ID = "usr_demo_operator";

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
const daysAgo = (d: number) => new Date(Date.now() - d * 86400_000).toISOString();

export async function seedIfEmpty(db: DB) {
  const existing = await db.select({ id: schema.users.id }).from(schema.users).limit(1);
  if (existing.length > 0) {
    await rotateDailyTasks(db);
    return;
  }
  await seedAll(db);
}

export async function resetDemo(db: DB) {
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
  await seedAll(db);
}

async function rotateDailyTasks(db: DB) {
  const today = todayKey();
  const rows = await db.select().from(schema.dailyTasks).limit(1);
  if (rows[0] && rows[0].forDate === today) return;
  await db.delete(schema.dailyTasks);
  await db.insert(schema.dailyTasks).values(taskRows(today));
}

async function seedAll(db: DB) {
  const createdAt = daysAgo(21);

  await db.insert(schema.users).values({
    id: DEMO_USER_ID,
    email: "operator@dropshipos.local",
    displayName: "Avery Chen",
    storeName: "Northline Supply",
    markupMultiplier: 3,
    spendLimitThreshold: 50,
    minRoasThreshold: 1.2,
    createdAt,
  });

  await db.insert(schema.suppliers).values([
    {
      id: "sup_goldendrop",
      name: "Golden Drop Gadgets",
      platform: "aliexpress",
      storeUrl: "https://www.aliexpress.com/store/1100001",
      avgShippingDays: 12,
      reliability: 0.94,
      notes: "Fastest on car & home SKUs. Watch weekend restocks.",
    },
    {
      id: "sup_petforge",
      name: "PetForge Wholesale",
      platform: "cj",
      storeUrl: "https://cjdropshipping.com",
      avgShippingDays: 9,
      reliability: 0.97,
      notes: "US warehouse for pet SKUs. Use for scaling winners.",
    },
    {
      id: "sup_lumen",
      name: "Lumen Home Factory",
      platform: "aliexpress",
      storeUrl: "https://www.aliexpress.com/store/1100002",
      avgShippingDays: 16,
      reliability: 0.88,
      notes: "Cheap lighting. QC photos before scaling ads.",
    },
  ]);

  const catalog = [
    {
      id: "prod_mount",
      raw: "2026 New Magnetic Car Phone Holder 360 Rotation Universal Air Vent Mount Wholesale Dropshipping",
      clean: "AeroMag Magnetic Phone Mount",
      niche: "car",
      cost: 4.12,
      ship: 1.85,
      days: 11,
      image:
        "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=80",
      status: "published",
      shopify: "gid://shopify/Product/1001",
      tags: "car,mount,magnetic",
      supplier: "Golden Drop Gadgets",
      url: "https://www.aliexpress.com/item/1005001.html",
      variants: [
        ["Black", 4.12, 214],
        ["Silver", 4.35, 96],
      ],
    },
    {
      id: "prod_fan",
      raw: "Portable Bladeless Neck Fan USB Rechargeable 3 Speed Summer Cooler Dropship Hot Sale",
      clean: "BreezeBand Neck Fan",
      niche: "home",
      cost: 6.4,
      ship: 2.1,
      days: 13,
      image:
        "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80",
      status: "published",
      shopify: "gid://shopify/Product/1002",
      tags: "summer,fan,portable",
      supplier: "Golden Drop Gadgets",
      url: "https://www.aliexpress.com/item/1005002.html",
      variants: [
        ["White", 6.4, 180],
        ["Black", 6.4, 142],
        ["Mint", 6.7, 40],
      ],
    },
    {
      id: "prod_sunset",
      raw: "LED Sunset Projector Lamp Rainbow Atmosphere Light TikTok Viral USB",
      clean: "Halo Dusk Projector Lamp",
      niche: "home",
      cost: 5.55,
      ship: 2.4,
      days: 15,
      image:
        "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&w=900&q=80",
      status: "published",
      shopify: "gid://shopify/Product/1003",
      tags: "lighting,tiktok,home",
      supplier: "Lumen Home Factory",
      url: "https://www.aliexpress.com/item/1005003.html",
      variants: [
        ["Sunset", 5.55, 260],
        ["Rainbow", 5.9, 77],
      ],
    },
    {
      id: "prod_pet",
      raw: "Pet Hair Remover Roller Reusable Fur Remover for Couch Car Seat Dog Cat",
      clean: "FurLift Reusable Hair Roller",
      niche: "pet",
      cost: 3.2,
      ship: 1.5,
      days: 8,
      image:
        "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=900&q=80",
      status: "published",
      shopify: "gid://shopify/Product/1004",
      tags: "pet,grooming,home",
      supplier: "PetForge Wholesale",
      url: "https://cjdropshipping.com/product/furlift",
      variants: [["Default", 3.2, 410]],
    },
    {
      id: "prod_shaver",
      raw: "Mini Electric Lint Remover Fabric Shaver USB Charge Sweater Fuzz",
      clean: "KnitKeep Fabric Shaver",
      niche: "home",
      cost: 4.9,
      ship: 1.7,
      days: 12,
      image:
        "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=80",
      status: "ready",
      shopify: null,
      tags: "fabric,home,grooming",
      supplier: "Golden Drop Gadgets",
      url: "https://www.aliexpress.com/item/1005005.html",
      variants: [
        ["White", 4.9, 88],
        ["Pink", 5.1, 22],
      ],
    },
    {
      id: "prod_bottle",
      raw: "Collapsible Silicone Water Bottle 600ml Outdoor Travel BPA Free",
      clean: "FoldSip Travel Bottle",
      niche: "outdoors",
      cost: 3.8,
      ship: 1.9,
      days: 14,
      image:
        "https://images.unsplash.com/photo-1523362628745-0c100150b504?auto=format&fit=crop&w=900&q=80",
      status: "draft",
      shopify: null,
      tags: "travel,bottle,outdoors",
      supplier: "Golden Drop Gadgets",
      url: "https://www.aliexpress.com/item/1005006.html",
      variants: [
        ["Ocean", 3.8, 70],
        ["Stone", 3.8, 54],
      ],
    },
    {
      id: "prod_mirror",
      raw: "Car Blind Spot Round Mirror 2pcs Adjustable Wide Angle Safety",
      clean: "LaneDot Blind Spot Mirrors",
      niche: "car",
      cost: 2.15,
      ship: 1.2,
      days: 10,
      image:
        "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=900&q=80",
      status: "published",
      shopify: "gid://shopify/Product/1007",
      tags: "car,safety,mirror",
      supplier: "Golden Drop Gadgets",
      url: "https://www.aliexpress.com/item/1005007.html",
      variants: [["2-pack", 2.15, 19]],
    },
    {
      id: "prod_proj",
      raw: "Mini Projector 1080P Portable Home Theater Android Wifi 2026 New",
      clean: "PocketCinema Mini Projector",
      niche: "home",
      cost: 28.4,
      ship: 4.5,
      days: 18,
      image:
        "https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&w=900&q=80",
      status: "ready",
      shopify: null,
      tags: "projector,home,gadget",
      supplier: "Lumen Home Factory",
      url: "https://www.aliexpress.com/item/1005008.html",
      variants: [["Black 1080p", 28.4, 31]],
    },
  ] as const;

  for (const p of catalog) {
    const retail = suggestedRetail(p.cost, p.ship, 3);
    await db.insert(schema.products).values({
      id: p.id,
      userId: DEMO_USER_ID,
      shopifyProductId: p.shopify,
      supplierSource: p.url.includes("cj") ? "cj" : "aliexpress",
      supplierUrl: p.url,
      supplierName: p.supplier,
      rawTitle: p.raw,
      cleanTitle: p.clean,
      descriptionHtml: `<p>${p.clean} is built for daily use: solid materials, simple setup, and a clean look that converts in ads.</p><ul><li>Supplier landed cost $${p.cost.toFixed(2)} + ship $${p.ship.toFixed(2)}</li><li>Typical delivery ${p.days} days</li><li>Retail tested at 3× markup</li></ul>`,
      tags: p.tags,
      imageUrl: p.image,
      galleryJson: JSON.stringify([p.image]),
      baseCost: p.cost,
      shippingCost: p.ship,
      retailPrice: retail,
      shippingDays: p.days,
      status: p.status,
      niche: p.niche,
      createdAt: daysAgo(18),
    });

    await db.insert(schema.productVariants).values(
      p.variants.map((v, i) => ({
        id: `${p.id}_var_${i + 1}`,
        productId: p.id,
        shopifyVariantId: p.shopify ? `${p.shopify}/v/${i + 1}` : null,
        supplierSkuId: `${p.id.toUpperCase()}-${i + 1}`,
        variantName: v[0],
        variantCost: v[1],
        variantPrice: suggestedRetail(v[1], p.ship, 3),
        inventoryCount: v[2],
        supplierImageUrl: p.image,
        cleanImageUrl: p.image,
      })),
    );
  }

  await db.insert(schema.campaignTrackers).values([
    {
      id: "camp_mount_meta",
      productId: "prod_mount",
      platform: "meta",
      adAccountId: "act_demo_meta",
      campaignId: "120001",
      adSetId: "230001",
      adSetName: "AeroMag — Broad US",
      spendLimitThreshold: 50,
      minRoasThreshold: 1.2,
      spendToday: 38.4,
      revenueToday: 126.6,
      ordersCount: 7,
      isPaused: false,
      lastPolledAt: hoursAgo(0.4),
    },
    {
      id: "camp_fan_meta",
      productId: "prod_fan",
      platform: "meta",
      adAccountId: "act_demo_meta",
      campaignId: "120002",
      adSetId: "230002",
      adSetName: "BreezeBand — Warm TOF",
      spendLimitThreshold: 40,
      minRoasThreshold: 1.3,
      spendToday: 54.9,
      revenueToday: 41.2,
      ordersCount: 2,
      isPaused: false,
      lastPolledAt: hoursAgo(0.3),
    },
    {
      id: "camp_sunset_tt",
      productId: "prod_sunset",
      platform: "tiktok",
      adAccountId: "tt_demo",
      campaignId: "99001",
      adSetId: "88001",
      adSetName: "Halo Dusk — Spark Spark",
      spendLimitThreshold: 60,
      minRoasThreshold: 1.15,
      spendToday: 22.1,
      revenueToday: 89.7,
      ordersCount: 4,
      isPaused: false,
      lastPolledAt: hoursAgo(0.6),
    },
    {
      id: "camp_pet_meta",
      productId: "prod_pet",
      platform: "meta",
      adAccountId: "act_demo_meta",
      campaignId: "120004",
      adSetId: "230004",
      adSetName: "FurLift — Lookalike",
      spendLimitThreshold: 80,
      minRoasThreshold: 1.4,
      spendToday: 19.75,
      revenueToday: 71.4,
      ordersCount: 6,
      isPaused: false,
      lastPolledAt: hoursAgo(0.2),
    },
  ]);

  const orderDefs: Array<{
    id: string;
    num: string;
    hours: number;
    name: string;
    email: string;
    address: string;
    productId: string;
    title: string;
    sku: string;
    qty: number;
    status: string;
    tracking?: string;
    supplierOrder?: string;
    carrier?: string;
  }> = [
    {
      id: "ord_10421",
      num: "#10421",
      hours: 2,
      name: "Maya Patel",
      email: "maya.p@example.com",
      address: "418 Pine St, Apt 4, Austin, TX 78701",
      productId: "prod_mount",
      title: "AeroMag Magnetic Phone Mount — Black",
      sku: "PROD_MOUNT-1",
      qty: 1,
      status: "pending_batch",
    },
    {
      id: "ord_10420",
      num: "#10420",
      hours: 5,
      name: "Luis Ortega",
      email: "luis.o@example.com",
      address: "90 Harbor Rd, Miami, FL 33132",
      productId: "prod_pet",
      title: "FurLift Reusable Hair Roller",
      sku: "PROD_PET-1",
      qty: 2,
      status: "pending_batch",
    },
    {
      id: "ord_10419",
      num: "#10419",
      hours: 9,
      name: "Hannah Brooks",
      email: "hannah.b@example.com",
      address: "12 Oak Lane, Denver, CO 80203",
      productId: "prod_sunset",
      title: "Halo Dusk Projector Lamp — Sunset",
      sku: "PROD_SUNSET-1",
      qty: 1,
      status: "pending_batch",
    },
    {
      id: "ord_10418",
      num: "#10418",
      hours: 18,
      name: "Chris Nguyen",
      email: "chris.n@example.com",
      address: "77 Market St, Seattle, WA 98104",
      productId: "prod_fan",
      title: "BreezeBand Neck Fan — White",
      sku: "PROD_FAN-1",
      qty: 1,
      status: "ordered_supplier",
      supplierOrder: "AE8821190",
    },
    {
      id: "ord_10415",
      num: "#10415",
      hours: 40,
      name: "Priya Shah",
      email: "priya.s@example.com",
      address: "5 Cedar Ave, Chicago, IL 60611",
      productId: "prod_mount",
      title: "AeroMag Magnetic Phone Mount — Silver",
      sku: "PROD_MOUNT-2",
      qty: 1,
      status: "shipped",
      supplierOrder: "AE8821002",
      tracking: "LP006128445CN",
      carrier: "YunExpress",
    },
    {
      id: "ord_10411",
      num: "#10411",
      hours: 70,
      name: "Jonah Ellis",
      email: "jonah.e@example.com",
      address: "210 Broad St, Atlanta, GA 30303",
      productId: "prod_pet",
      title: "FurLift Reusable Hair Roller",
      sku: "PROD_PET-1",
      qty: 1,
      status: "shipped",
      supplierOrder: "CJ441902",
      tracking: "926129990123456",
      carrier: "USPS",
    },
    {
      id: "ord_10398",
      num: "#10398",
      hours: 96,
      name: "Elena Rossi",
      email: "elena.r@example.com",
      address: "8 King St, Boston, MA 02110",
      productId: "prod_sunset",
      title: "Halo Dusk Projector Lamp — Rainbow",
      sku: "PROD_SUNSET-2",
      qty: 1,
      status: "delivered",
      supplierOrder: "AE8819901",
      tracking: "LP006120001CN",
      carrier: "YunExpress",
    },
    {
      id: "ord_10390",
      num: "#10390",
      hours: 120,
      name: "Marcus Hale",
      email: "marcus.h@example.com",
      address: "44 Vine Ct, Phoenix, AZ 85004",
      productId: "prod_mirror",
      title: "LaneDot Blind Spot Mirrors — 2-pack",
      sku: "PROD_MIRROR-1",
      qty: 1,
      status: "refunded",
      supplierOrder: "AE8818700",
    },
    {
      id: "ord_10408",
      num: "#10408",
      hours: 52,
      name: "Sofia Alvarez",
      email: "sofia.a@example.com",
      address: "19 River Way, Portland, OR 97201",
      productId: "prod_fan",
      title: "BreezeBand Neck Fan — Mint",
      sku: "PROD_FAN-3",
      qty: 1,
      status: "ordered_supplier",
      supplierOrder: "AE8820909",
    },
    {
      id: "ord_10422",
      num: "#10422",
      hours: 1,
      name: "Noah Kim",
      email: "noah.k@example.com",
      address: "301 Elm St, Dallas, TX 75201",
      productId: "prod_pet",
      title: "FurLift Reusable Hair Roller",
      sku: "PROD_PET-1",
      qty: 1,
      status: "pending_batch",
    },
  ];

  const productById = Object.fromEntries(catalog.map((p) => [p.id, p]));

  for (const o of orderDefs) {
    const p = productById[o.productId];
    const retail = suggestedRetail(p.cost, p.ship, 3) * o.qty;
    const cogs = (p.cost + p.ship) * o.qty;
    const fee = processorFee(retail);
    const margin = netProfit({ revenue: retail, cogs });
    await db.insert(schema.orders).values({
      id: o.id,
      userId: DEMO_USER_ID,
      shopifyOrderId: `gid://shopify/Order/${o.num.replace("#", "")}`,
      orderNumber: o.num,
      customerName: o.name,
      customerEmail: o.email,
      shippingAddress: o.address,
      totalRevenue: retail,
      totalCogs: cogs,
      paymentFee: fee,
      netMargin: margin,
      fulfillmentStatus: o.status,
      supplierOrderId: o.supplierOrder ?? null,
      trackingNumber: o.tracking ?? null,
      carrier: o.carrier ?? null,
      createdAt: hoursAgo(o.hours),
    });
    await db.insert(schema.orderItems).values({
      id: `${o.id}_item`,
      orderId: o.id,
      productId: o.productId,
      variantId: `${o.productId}_var_1`,
      title: o.title,
      sku: o.sku,
      quantity: o.qty,
      unitPrice: suggestedRetail(p.cost, p.ship, 3),
      unitCost: p.cost + p.ship,
      supplierUrl: p.url,
    });
  }

  await db.insert(schema.refunds).values([
    {
      id: "ref_10390",
      orderId: "ord_10390",
      reason: "Item never arrived — 28 days, customer requested refund",
      amount: suggestedRetail(2.15, 1.2, 3),
      status: "open",
      createdAt: hoursAgo(8),
    },
  ]);

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

  await db.insert(schema.dailyTasks).values(taskRows(todayKey()));

  await db.insert(schema.activityLog).values([
    {
      id: "act_1",
      kind: "alert",
      message: "Margin Guard flagged BreezeBand — Broad US: spend $54.90 vs $41.20 revenue.",
      href: "/ads",
      createdAt: hoursAgo(0.3),
    },
    {
      id: "act_2",
      kind: "order",
      message: "4 orders waiting in the batch fulfillment queue.",
      href: "/fulfillment",
      createdAt: hoursAgo(1),
    },
    {
      id: "act_3",
      kind: "inventory",
      message: "LaneDot Blind Spot Mirrors down to 19 units at supplier.",
      href: "/suppliers",
      createdAt: hoursAgo(3),
    },
    {
      id: "act_4",
      kind: "publish",
      message: "FurLift Reusable Hair Roller published to Shopify (demo).",
      href: "/catalog/prod_pet",
      createdAt: hoursAgo(26),
    },
    {
      id: "act_5",
      kind: "cs",
      message: "Refund open on #10390 — 28-day no-scan.",
      href: "/ops",
      createdAt: hoursAgo(8),
    },
  ]);

  await db.insert(schema.settings).values([
    { key: "seeded_at", value: nowIso() },
    { key: "demo_mode", value: "true" },
  ]);
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
