import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { users } from "./schema";

export const shopifyConnections = sqliteTable(
  "shopify_connections",
  {
    id: text("id").primaryKey(),
    storeId: text("store_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    shopDomain: text("shop_domain").notNull(),
    primaryDomain: text("primary_domain"),
    accessTokenEnc: text("access_token_enc").notNull(),
    scopesJson: text("scopes_json").notNull().default("[]"),
    ianaTimezone: text("iana_timezone").notNull().default("UTC"),
    currency: text("currency").notNull().default("USD"),
    planName: text("plan_name"),
    installedAt: text("installed_at").notNull(),
    uninstalledAt: text("uninstalled_at"),
    lastReconciledAt: text("last_reconciled_at"),
    webhooksVerifiedAt: text("webhooks_verified_at"),
    status: text("status").notNull().default("ACTIVE"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("idx_shopify_conn_store").on(t.storeId),
    uniqueIndex("idx_shopify_conn_shop").on(t.shopDomain),
  ],
);

export const metaConnections = sqliteTable("meta_connections", {
  id: text("id").primaryKey(),
  storeId: text("store_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  metaUserId: text("meta_user_id").notNull(),
  accessTokenEnc: text("access_token_enc").notNull(),
  tokenType: text("token_type").notNull(),
  tokenExpiresAt: text("token_expires_at"),
  grantedScopesJson: text("granted_scopes_json").notNull().default("[]"),
  status: text("status").notNull().default("ACTIVE"),
  lastErrorCode: text("last_error_code"),
  lastErrorAt: text("last_error_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const metaAdAccounts = sqliteTable("meta_ad_accounts", {
  id: text("id").primaryKey(),
  metaConnectionId: text("meta_connection_id")
    .notNull()
    .references(() => metaConnections.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  currency: text("currency").notNull(),
  timezoneName: text("timezone_name").notNull(),
  timezoneOffsetHoursUtc: real("timezone_offset_hours_utc").notNull().default(0),
  accountStatus: integer("account_status").notNull().default(1),
  guardEnabled: integer("guard_enabled", { mode: "boolean" }).notNull().default(false),
  lastInsightsSyncAt: text("last_insights_sync_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const storeFinanceConfigs = sqliteTable("store_finance_configs", {
  storeId: text("store_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  paymentFeePct: real("payment_fee_pct").notNull().default(0.029),
  paymentFixedFee: real("payment_fixed_fee").notNull().default(0.3),
  currencyConversionPct: real("currency_conversion_pct").notNull().default(0),
  defaultShippingCost: real("default_shipping_cost").notNull().default(0),
  defaultCogsPctOfPrice: real("default_cogs_pct_of_price"),
  refundReservePct: real("refund_reserve_pct").notNull().default(0.03),
  guardMode: text("guard_mode").notNull().default("ALERT_ONLY"),
  autoPauseConsentAt: text("auto_pause_consent_at"),
  autoPauseConsentBy: text("auto_pause_consent_by"),
  breakEvenMultiplier: real("break_even_multiplier").notNull().default(1.75),
  minSpendFloor: real("min_spend_floor").notNull().default(10),
  lossTolerancePct: real("loss_tolerance_pct").notNull().default(0.25),
  attributionLagHours: integer("attribution_lag_hours").notNull().default(3),
  evaluationWindowDays: integer("evaluation_window_days").notNull().default(3),
  consecutiveHitsRequired: integer("consecutive_hits_required").notNull().default(2),
  maxAutoPausesPerDay: integer("max_auto_pauses_per_day").notNull().default(3),
  purchaseSignal: text("purchase_signal").notNull().default("OMNI_PURCHASE"),
  updatedAt: text("updated_at").notNull(),
});

export const paymentGatewayFeeOverrides = sqliteTable(
  "payment_gateway_fee_overrides",
  {
    id: text("id").primaryKey(),
    storeId: text("store_id")
      .notNull()
      .references(() => storeFinanceConfigs.storeId, { onDelete: "cascade" }),
    gateway: text("gateway").notNull(),
    feePct: real("fee_pct").notNull(),
    fixedFee: real("fixed_fee").notNull(),
  },
  (t) => [uniqueIndex("idx_gateway_fee_store").on(t.storeId, t.gateway)],
);

export const variantCosts = sqliteTable(
  "variant_costs",
  {
    id: text("id").primaryKey(),
    storeId: text("store_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    shopifyVariantId: text("shopify_variant_id").notNull(),
    shopifyProductId: text("shopify_product_id").notNull(),
    sku: text("sku"),
    unitCogs: real("unit_cogs").notNull(),
    unitShippingCost: real("unit_shipping_cost").notNull().default(0),
    source: text("source").notNull(),
    effectiveFrom: text("effective_from").notNull(),
    effectiveTo: text("effective_to"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("idx_variant_cost_lookup").on(t.storeId, t.shopifyVariantId, t.effectiveFrom)],
);

export const shopifyOrders = sqliteTable(
  "shopify_orders",
  {
    id: text("id").primaryKey(),
    storeId: text("store_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    test: integer("test", { mode: "boolean" }).notNull().default(false),
    createdAtUtc: text("created_at_utc").notNull(),
    processedAtUtc: text("processed_at_utc").notNull(),
    cancelledAtUtc: text("cancelled_at_utc"),
    shopLocalDate: text("shop_local_date").notNull(),
    adAccountLocalDate: text("ad_account_local_date"),
    financialStatus: text("financial_status").notNull(),
    currency: text("currency").notNull(),
    subtotal: real("subtotal").notNull().default(0),
    totalDiscounts: real("total_discounts").notNull().default(0),
    shippingCharged: real("shipping_charged").notNull().default(0),
    totalTax: real("total_tax").notNull().default(0),
    totalPrice: real("total_price").notNull().default(0),
    totalRefunded: real("total_refunded").notNull().default(0),
    gatewaysJson: text("gateways_json").notNull().default("[]"),
    sourceName: text("source_name"),
    landingSite: text("landing_site"),
    referringSite: text("referring_site"),
    firstUtmSource: text("first_utm_source"),
    firstUtmMedium: text("first_utm_medium"),
    firstUtmCampaign: text("first_utm_campaign"),
    firstUtmTerm: text("first_utm_term"),
    firstUtmContent: text("first_utm_content"),
    lastUtmSource: text("last_utm_source"),
    lastUtmMedium: text("last_utm_medium"),
    lastUtmCampaign: text("last_utm_campaign"),
    lastUtmTerm: text("last_utm_term"),
    lastUtmContent: text("last_utm_content"),
    customerIdHash: text("customer_id_hash"),
    cogsTotal: real("cogs_total").notNull().default(0),
    shippingCostTotal: real("shipping_cost_total").notNull().default(0),
    paymentFees: real("payment_fees").notNull().default(0),
    contributionMargin: real("contribution_margin").notNull().default(0),
    costsComplete: integer("costs_complete", { mode: "boolean" }).notNull().default(false),
    shopifyUpdatedAt: text("shopify_updated_at").notNull(),
    syncedAt: text("synced_at").notNull(),
  },
  (t) => [
    index("idx_shopify_orders_store_processed").on(t.storeId, t.processedAtUtc),
    index("idx_shopify_orders_utm_term").on(t.storeId, t.lastUtmTerm),
  ],
);

export const shopifyLineItems = sqliteTable("shopify_line_items", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => shopifyOrders.id, { onDelete: "cascade" }),
  shopifyProductId: text("shopify_product_id"),
  shopifyVariantId: text("shopify_variant_id"),
  sku: text("sku"),
  quantity: integer("quantity").notNull(),
  refundedQuantity: integer("refunded_quantity").notNull().default(0),
  unitPrice: real("unit_price").notNull(),
  totalDiscount: real("total_discount").notNull().default(0),
  unitCogsSnapshot: real("unit_cogs_snapshot"),
  unitShipSnapshot: real("unit_ship_snapshot"),
  costSourceSnapshot: text("cost_source_snapshot"),
});

export const shopifyRefunds = sqliteTable("shopify_refunds", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => shopifyOrders.id, { onDelete: "cascade" }),
  createdAtUtc: text("created_at_utc").notNull(),
  amount: real("amount").notNull(),
  restockedQty: integer("restocked_qty").notNull().default(0),
});

export const adAttributions = sqliteTable(
  "ad_attributions",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => shopifyOrders.id, { onDelete: "cascade" }),
    platform: text("platform").notNull().default("meta"),
    model: text("model").notNull(),
    campaignId: text("campaign_id"),
    adsetId: text("adset_id"),
    adId: text("ad_id"),
    confidence: text("confidence").notNull(),
    matchedAt: text("matched_at").notNull(),
  },
  (t) => [
    uniqueIndex("idx_ad_attr_order_model").on(t.orderId, t.model),
    index("idx_ad_attr_adset").on(t.adsetId),
  ],
);

export const metaEntities = sqliteTable(
  "meta_entities",
  {
    id: text("id").primaryKey(),
    adAccountId: text("ad_account_id").notNull(),
    level: text("level").notNull(),
    parentId: text("parent_id"),
    name: text("name").notNull(),
    status: text("status").notNull(),
    effectiveStatus: text("effective_status").notNull(),
    dailyBudget: real("daily_budget"),
    landingUrl: text("landing_url"),
    urlTags: text("url_tags"),
    mappedProductId: text("mapped_product_id"),
    createdTimeUtc: text("created_time_utc").notNull(),
    updatedTimeUtc: text("updated_time_utc").notNull(),
    syncedAt: text("synced_at").notNull(),
  },
  (t) => [index("idx_meta_entities_acct_level").on(t.adAccountId, t.level)],
);

export const adPerformanceSnapshots = sqliteTable(
  "ad_performance_snapshots",
  {
    id: text("id").primaryKey(),
    adAccountId: text("ad_account_id").notNull(),
    level: text("level").notNull(),
    entityId: text("entity_id").notNull(),
    snapshotAtUtc: text("snapshot_at_utc").notNull(),
    windowStartLocal: text("window_start_local").notNull(),
    windowEndLocal: text("window_end_local").notNull(),
    attributionSetting: text("attribution_setting").notNull(),
    accountCurrency: text("account_currency").notNull(),
    fxToShopCurrency: real("fx_to_shop_currency").notNull().default(1),
    spend: real("spend").notNull().default(0),
    impressions: integer("impressions").notNull().default(0),
    inlineLinkClicks: integer("inline_link_clicks").notNull().default(0),
    addToCart: integer("add_to_cart").notNull().default(0),
    purchases: integer("purchases").notNull().default(0),
    purchaseValue: real("purchase_value").notNull().default(0),
    firstSpendAtUtc: text("first_spend_at_utc"),
    rawJson: text("raw_json").notNull().default("{}"),
  },
  (t) => [index("idx_ad_snap_entity").on(t.entityId, t.snapshotAtUtc)],
);

export const guardStates = sqliteTable("guard_states", {
  adsetId: text("adset_id").primaryKey(),
  adAccountId: text("ad_account_id").notNull(),
  storeId: text("store_id").notNull(),
  state: text("state").notNull().default("MONITORING"),
  consecutiveHits: integer("consecutive_hits").notNull().default(0),
  candidateSinceUtc: text("candidate_since_utc"),
  floorCrossedAtUtc: text("floor_crossed_at_utc"),
  snoozedUntilUtc: text("snoozed_until_utc"),
  snoozeSpendMark: real("snooze_spend_mark"),
  exempt: integer("exempt", { mode: "boolean" }).notNull().default(false),
  lastEvaluationId: text("last_evaluation_id"),
  updatedAt: text("updated_at").notNull(),
});

export const guardEvaluations = sqliteTable(
  "guard_evaluations",
  {
    id: text("id").primaryKey(),
    adsetId: text("adset_id").notNull(),
    evaluatedAtUtc: text("evaluated_at_utc").notNull(),
    formulaVersion: text("formula_version").notNull(),
    inputsJson: text("inputs_json").notNull(),
    verdict: text("verdict").notNull(),
    reasonCodesJson: text("reason_codes_json").notNull().default("[]"),
  },
  (t) => [index("idx_guard_eval_adset").on(t.adsetId, t.evaluatedAtUtc)],
);

export const guardActions = sqliteTable(
  "guard_actions",
  {
    id: text("id").primaryKey(),
    adsetId: text("adset_id").notNull(),
    adAccountId: text("ad_account_id").notNull(),
    storeId: text("store_id").notNull(),
    evaluationId: text("evaluation_id").notNull(),
    kind: text("kind").notNull(),
    actor: text("actor").notNull(),
    mode: text("mode").notNull(),
    requestedAtUtc: text("requested_at_utc").notNull(),
    executedAtUtc: text("executed_at_utc"),
    priorStatus: text("prior_status"),
    metaResponseJson: text("meta_response_json"),
    result: text("result").notNull(),
    undoTokenHash: text("undo_token_hash"),
    undoExpiresAtUtc: text("undo_expires_at_utc"),
    undoneByActionId: text("undone_by_action_id"),
  },
  (t) => [
    uniqueIndex("idx_guard_action_undo").on(t.undoTokenHash),
    index("idx_guard_action_acct").on(t.adAccountId, t.requestedAtUtc),
  ],
);

export const webhookEvents = sqliteTable(
  "webhook_events",
  {
    id: text("id").primaryKey(),
    dedupeKey: text("dedupe_key").notNull(),
    topic: text("topic").notNull(),
    shopDomain: text("shop_domain").notNull(),
    apiVersion: text("api_version"),
    triggeredAt: text("triggered_at"),
    receivedAtUtc: text("received_at_utc").notNull(),
    payloadHash: text("payload_hash").notNull(),
    resourceGid: text("resource_gid"),
    status: text("status").notNull().default("RECEIVED"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    processedAt: text("processed_at"),
  },
  (t) => [
    uniqueIndex("idx_webhook_dedupe").on(t.dedupeKey),
    index("idx_webhook_shop_topic").on(t.shopDomain, t.topic, t.receivedAtUtc),
  ],
);

export const complianceRequests = sqliteTable("compliance_requests", {
  id: text("id").primaryKey(),
  topic: text("topic").notNull(),
  shopDomain: text("shop_domain").notNull(),
  shopifyCustomerId: text("shopify_customer_id"),
  ordersRequestedJson: text("orders_requested_json").notNull().default("[]"),
  payloadJson: text("payload_json").notNull().default("{}"),
  receivedAtUtc: text("received_at_utc").notNull(),
  dueByUtc: text("due_by_utc").notNull(),
  completedAtUtc: text("completed_at_utc"),
});

export const utmCheckResults = sqliteTable(
  "utm_check_results",
  {
    id: text("id").primaryKey(),
    adId: text("ad_id").notNull(),
    adsetId: text("adset_id").notNull(),
    adAccountId: text("ad_account_id").notNull(),
    checkedAtUtc: text("checked_at_utc").notNull(),
    status: text("status").notNull(),
    issuesJson: text("issues_json").notNull().default("[]"),
  },
  (t) => [index("idx_utm_check_acct").on(t.adAccountId, t.checkedAtUtc)],
);

export const jobRuns = sqliteTable(
  "job_runs",
  {
    id: text("id").primaryKey(),
    job: text("job").notNull(),
    scopeKey: text("scope_key").notNull(),
    startedAt: text("started_at").notNull(),
    finishedAt: text("finished_at"),
    ok: integer("ok", { mode: "boolean" }),
    statsJson: text("stats_json"),
    error: text("error"),
  },
  (t) => [index("idx_job_runs_scope").on(t.job, t.scopeKey, t.startedAt)],
);
