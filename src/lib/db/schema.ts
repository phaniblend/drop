import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull().default("Operator"),
  storeName: text("store_name").notNull().default("SetoStore"),
  shopifyDomain: text("shopify_domain"),
  shopifyAccessToken: text("shopify_access_token"),
  metaAccessToken: text("meta_access_token"),
  tiktokAccessToken: text("tiktok_access_token"),
  markupMultiplier: real("markup_multiplier").notNull().default(3),
  spendLimitThreshold: real("spend_limit_threshold").notNull().default(50),
  minRoasThreshold: real("min_roas_threshold").notNull().default(1.2),
  feeRate: real("fee_rate").notNull().default(0.029),
  feeFixed: real("fee_fixed").notNull().default(0.3),
  timezone: text("timezone").notNull().default("America/Chicago"),
  sentinelSettings: text("sentinel_settings").notNull().default(
    '{"enabled":true,"hookSpend":5,"minCtr":1.5,"maxCpc":1.8,"intentSpend":15}',
  ),
  daypartingEnabled: integer("dayparting_enabled", { mode: "boolean" }).notNull().default(false),
  subscriptionTier: text("subscription_tier").notNull().default("trial_5"),
  subscriptionStatus: text("subscription_status").notNull().default("active"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  productsImportedCount: integer("products_imported_count").notNull().default(0),
  lensSearchesCount: integer("lens_searches_count").notNull().default(0),
  billingCycleStart: text("billing_cycle_start"),
  billingCycleEnd: text("billing_cycle_end"),
  createdAt: text("created_at").notNull(),
});

export const products = sqliteTable(
  "products",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    shopifyProductId: text("shopify_product_id"),
    supplierSource: text("supplier_source").notNull().default("aliexpress"),
    supplierUrl: text("supplier_url").notNull(),
    supplierName: text("supplier_name").notNull().default("AliExpress"),
    rawTitle: text("raw_title").notNull(),
    cleanTitle: text("clean_title"),
    descriptionHtml: text("description_html"),
    tags: text("tags").notNull().default(""),
    imageUrl: text("image_url"),
    galleryJson: text("gallery_json").notNull().default("[]"),
    baseCost: real("base_cost").notNull(),
    shippingCost: real("shipping_cost").notNull().default(0),
    retailPrice: real("retail_price").notNull(),
    markupMultiplier: real("markup_multiplier").notNull().default(3),
    shippingDays: integer("shipping_days").notNull().default(14),
    status: text("status").notNull().default("draft"),
    niche: text("niche").notNull().default("general"),
    organicStatus: text("organic_status").notNull().default("pending"),
    organicViewsJson: text("organic_views_json").notNull().default("[0,0,0]"),
    adAnglesJson: text("ad_angles_json").notNull().default("[]"),
    adAnglesPrevJson: text("ad_angles_prev_json").notNull().default("[]"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("idx_products_user").on(t.userId), index("idx_products_status").on(t.status)],
);

export const productVariants = sqliteTable("product_variants", {
  id: text("id").primaryKey(),
  productId: text("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  shopifyVariantId: text("shopify_variant_id"),
  supplierSkuId: text("supplier_sku_id").notNull(),
  variantName: text("variant_name").notNull(),
  variantCost: real("variant_cost").notNull(),
  variantPrice: real("variant_price").notNull(),
  inventoryCount: integer("inventory_count").notNull().default(0),
  supplierImageUrl: text("supplier_image_url"),
  cleanImageUrl: text("clean_image_url"),
});

export const campaignTrackers = sqliteTable(
  "campaign_trackers",
  {
    id: text("id").primaryKey(),
    productId: text("product_id").references(() => products.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(),
    adAccountId: text("ad_account_id").notNull(),
    campaignId: text("campaign_id").notNull(),
    adSetId: text("ad_set_id").notNull(),
    adSetName: text("ad_set_name"),
    spendLimitThreshold: real("spend_limit_threshold").notNull().default(50),
    minRoasThreshold: real("min_roas_threshold").notNull().default(1.2),
    spendToday: real("spend_today").notNull().default(0),
    revenueToday: real("revenue_today").notNull().default(0),
    ordersCount: integer("orders_count").notNull().default(0),
    isPaused: integer("is_paused", { mode: "boolean" }).notNull().default(false),
    impressions: real("impressions").notNull().default(0),
    clicks: real("clicks").notNull().default(0),
    addToCartCount: integer("add_to_cart_count").notNull().default(0),
    pauseReason: text("pause_reason"),
    pauseSource: text("pause_source"),
    lastPolledAt: text("last_polled_at").notNull(),
  },
  (t) => [index("idx_trackers_adset").on(t.adSetId)],
);

export const orders = sqliteTable(
  "orders",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    shopifyOrderId: text("shopify_order_id").notNull().unique(),
    orderNumber: text("order_number").notNull(),
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email").notNull(),
    shippingAddress: text("shipping_address").notNull(),
    totalRevenue: real("total_revenue").notNull(),
    totalCogs: real("total_cogs").notNull(),
    paymentFee: real("payment_fee").notNull(),
    netMargin: real("net_margin").notNull(),
    fulfillmentStatus: text("fulfillment_status").notNull().default("pending_batch"),
    supplierOrderId: text("supplier_order_id"),
    trackingNumber: text("tracking_number"),
    carrier: text("carrier"),
    notes: text("notes"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("idx_orders_fulfillment").on(t.fulfillmentStatus)],
);

export const orderItems = sqliteTable("order_items", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  productId: text("product_id").references(() => products.id, { onDelete: "set null" }),
  variantId: text("variant_id"),
  title: text("title").notNull(),
  sku: text("sku").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: real("unit_price").notNull(),
  unitCost: real("unit_cost").notNull(),
  supplierUrl: text("supplier_url"),
});

export const suppliers = sqliteTable("suppliers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  platform: text("platform").notNull().default("aliexpress"),
  storeUrl: text("store_url"),
  avgShippingDays: integer("avg_shipping_days").notNull().default(14),
  reliability: real("reliability").notNull().default(0.9),
  notes: text("notes"),
});

export const csMacros = sqliteTable("cs_macros", {
  id: text("id").primaryKey(),
  category: text("category").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
});

export const dailyTasks = sqliteTable("daily_tasks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  detail: text("detail"),
  done: integer("done", { mode: "boolean" }).notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  forDate: text("for_date").notNull(),
});

export const refunds = sqliteTable("refunds", {
  id: text("id").primaryKey(),
  orderId: text("order_id").references(() => orders.id, { onDelete: "set null" }),
  reason: text("reason").notNull(),
  amount: real("amount").notNull(),
  status: text("status").notNull().default("open"),
  createdAt: text("created_at").notNull(),
});

export const activityLog = sqliteTable("activity_log", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  message: text("message").notNull(),
  href: text("href"),
  createdAt: text("created_at").notNull(),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type User = typeof users.$inferSelect;
export type Product = typeof products.$inferSelect;
export type ProductVariant = typeof productVariants.$inferSelect;
export type CampaignTracker = typeof campaignTrackers.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type Supplier = typeof suppliers.$inferSelect;
export type CsMacro = typeof csMacros.$inferSelect;
export type DailyTask = typeof dailyTasks.$inferSelect;
export type Refund = typeof refunds.$inferSelect;
export type Activity = typeof activityLog.$inferSelect;
