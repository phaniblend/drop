export const MARGIN_GUARD_DDL = `
CREATE TABLE IF NOT EXISTS shopify_connections (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shop_domain TEXT NOT NULL,
  primary_domain TEXT,
  access_token_enc TEXT NOT NULL,
  scopes_json TEXT NOT NULL DEFAULT '[]',
  iana_timezone TEXT NOT NULL DEFAULT 'UTC',
  currency TEXT NOT NULL DEFAULT 'USD',
  plan_name TEXT,
  installed_at TEXT NOT NULL,
  uninstalled_at TEXT,
  last_reconciled_at TEXT,
  webhooks_verified_at TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_shopify_conn_store ON shopify_connections(store_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_shopify_conn_shop ON shopify_connections(shop_domain);

CREATE TABLE IF NOT EXISTS meta_connections (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  meta_user_id TEXT NOT NULL,
  access_token_enc TEXT NOT NULL,
  token_type TEXT NOT NULL,
  token_expires_at TEXT,
  granted_scopes_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  last_error_code TEXT,
  last_error_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meta_ad_accounts (
  id TEXT PRIMARY KEY,
  meta_connection_id TEXT NOT NULL REFERENCES meta_connections(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  currency TEXT NOT NULL,
  timezone_name TEXT NOT NULL,
  timezone_offset_hours_utc REAL NOT NULL DEFAULT 0,
  account_status INTEGER NOT NULL DEFAULT 1,
  guard_enabled INTEGER NOT NULL DEFAULT 0,
  last_insights_sync_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS store_finance_configs (
  store_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  payment_fee_pct REAL NOT NULL DEFAULT 0.029,
  payment_fixed_fee REAL NOT NULL DEFAULT 0.30,
  currency_conversion_pct REAL NOT NULL DEFAULT 0,
  default_shipping_cost REAL NOT NULL DEFAULT 0,
  default_cogs_pct_of_price REAL,
  refund_reserve_pct REAL NOT NULL DEFAULT 0.03,
  guard_mode TEXT NOT NULL DEFAULT 'ALERT_ONLY',
  auto_pause_consent_at TEXT,
  auto_pause_consent_by TEXT,
  break_even_multiplier REAL NOT NULL DEFAULT 1.75,
  min_spend_floor REAL NOT NULL DEFAULT 10,
  loss_tolerance_pct REAL NOT NULL DEFAULT 0.25,
  attribution_lag_hours INTEGER NOT NULL DEFAULT 3,
  evaluation_window_days INTEGER NOT NULL DEFAULT 3,
  consecutive_hits_required INTEGER NOT NULL DEFAULT 2,
  max_auto_pauses_per_day INTEGER NOT NULL DEFAULT 3,
  purchase_signal TEXT NOT NULL DEFAULT 'OMNI_PURCHASE',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payment_gateway_fee_overrides (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES store_finance_configs(store_id) ON DELETE CASCADE,
  gateway TEXT NOT NULL,
  fee_pct REAL NOT NULL,
  fixed_fee REAL NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_gateway_fee_store ON payment_gateway_fee_overrides(store_id, gateway);

CREATE TABLE IF NOT EXISTS variant_costs (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shopify_variant_id TEXT NOT NULL,
  shopify_product_id TEXT NOT NULL,
  sku TEXT,
  unit_cogs REAL NOT NULL,
  unit_shipping_cost REAL NOT NULL DEFAULT 0,
  source TEXT NOT NULL,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_variant_cost_lookup ON variant_costs(store_id, shopify_variant_id, effective_from);

CREATE TABLE IF NOT EXISTS shopify_orders (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  test INTEGER NOT NULL DEFAULT 0,
  created_at_utc TEXT NOT NULL,
  processed_at_utc TEXT NOT NULL,
  cancelled_at_utc TEXT,
  shop_local_date TEXT NOT NULL,
  ad_account_local_date TEXT,
  financial_status TEXT NOT NULL,
  currency TEXT NOT NULL,
  subtotal REAL NOT NULL DEFAULT 0,
  total_discounts REAL NOT NULL DEFAULT 0,
  shipping_charged REAL NOT NULL DEFAULT 0,
  total_tax REAL NOT NULL DEFAULT 0,
  total_price REAL NOT NULL DEFAULT 0,
  total_refunded REAL NOT NULL DEFAULT 0,
  gateways_json TEXT NOT NULL DEFAULT '[]',
  source_name TEXT,
  landing_site TEXT,
  referring_site TEXT,
  first_utm_source TEXT,
  first_utm_medium TEXT,
  first_utm_campaign TEXT,
  first_utm_term TEXT,
  first_utm_content TEXT,
  last_utm_source TEXT,
  last_utm_medium TEXT,
  last_utm_campaign TEXT,
  last_utm_term TEXT,
  last_utm_content TEXT,
  customer_id_hash TEXT,
  cogs_total REAL NOT NULL DEFAULT 0,
  shipping_cost_total REAL NOT NULL DEFAULT 0,
  payment_fees REAL NOT NULL DEFAULT 0,
  contribution_margin REAL NOT NULL DEFAULT 0,
  costs_complete INTEGER NOT NULL DEFAULT 0,
  shopify_updated_at TEXT NOT NULL,
  synced_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_shopify_orders_store_processed ON shopify_orders(store_id, processed_at_utc);
CREATE INDEX IF NOT EXISTS idx_shopify_orders_utm_term ON shopify_orders(store_id, last_utm_term);

CREATE TABLE IF NOT EXISTS shopify_line_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES shopify_orders(id) ON DELETE CASCADE,
  shopify_product_id TEXT,
  shopify_variant_id TEXT,
  sku TEXT,
  quantity INTEGER NOT NULL,
  refunded_quantity INTEGER NOT NULL DEFAULT 0,
  unit_price REAL NOT NULL,
  total_discount REAL NOT NULL DEFAULT 0,
  unit_cogs_snapshot REAL,
  unit_ship_snapshot REAL,
  cost_source_snapshot TEXT
);

CREATE TABLE IF NOT EXISTS shopify_refunds (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES shopify_orders(id) ON DELETE CASCADE,
  created_at_utc TEXT NOT NULL,
  amount REAL NOT NULL,
  restocked_qty INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ad_attributions (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES shopify_orders(id) ON DELETE CASCADE,
  platform TEXT NOT NULL DEFAULT 'meta',
  model TEXT NOT NULL,
  campaign_id TEXT,
  adset_id TEXT,
  ad_id TEXT,
  confidence TEXT NOT NULL,
  matched_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ad_attr_order_model ON ad_attributions(order_id, model);
CREATE INDEX IF NOT EXISTS idx_ad_attr_adset ON ad_attributions(adset_id);

CREATE TABLE IF NOT EXISTS meta_entities (
  id TEXT PRIMARY KEY,
  ad_account_id TEXT NOT NULL,
  level TEXT NOT NULL,
  parent_id TEXT,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  effective_status TEXT NOT NULL,
  daily_budget REAL,
  landing_url TEXT,
  url_tags TEXT,
  mapped_product_id TEXT,
  created_time_utc TEXT NOT NULL,
  updated_time_utc TEXT NOT NULL,
  synced_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_meta_entities_acct_level ON meta_entities(ad_account_id, level);

CREATE TABLE IF NOT EXISTS ad_performance_snapshots (
  id TEXT PRIMARY KEY,
  ad_account_id TEXT NOT NULL,
  level TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  snapshot_at_utc TEXT NOT NULL,
  window_start_local TEXT NOT NULL,
  window_end_local TEXT NOT NULL,
  attribution_setting TEXT NOT NULL,
  account_currency TEXT NOT NULL,
  fx_to_shop_currency REAL NOT NULL DEFAULT 1,
  spend REAL NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  inline_link_clicks INTEGER NOT NULL DEFAULT 0,
  add_to_cart INTEGER NOT NULL DEFAULT 0,
  purchases INTEGER NOT NULL DEFAULT 0,
  purchase_value REAL NOT NULL DEFAULT 0,
  first_spend_at_utc TEXT,
  raw_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_ad_snap_entity ON ad_performance_snapshots(entity_id, snapshot_at_utc);

CREATE TABLE IF NOT EXISTS guard_states (
  adset_id TEXT PRIMARY KEY,
  ad_account_id TEXT NOT NULL,
  store_id TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'MONITORING',
  consecutive_hits INTEGER NOT NULL DEFAULT 0,
  candidate_since_utc TEXT,
  floor_crossed_at_utc TEXT,
  snoozed_until_utc TEXT,
  snooze_spend_mark REAL,
  exempt INTEGER NOT NULL DEFAULT 0,
  last_evaluation_id TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS guard_evaluations (
  id TEXT PRIMARY KEY,
  adset_id TEXT NOT NULL,
  evaluated_at_utc TEXT NOT NULL,
  formula_version TEXT NOT NULL,
  inputs_json TEXT NOT NULL,
  verdict TEXT NOT NULL,
  reason_codes_json TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_guard_eval_adset ON guard_evaluations(adset_id, evaluated_at_utc);

CREATE TABLE IF NOT EXISTS guard_actions (
  id TEXT PRIMARY KEY,
  adset_id TEXT NOT NULL,
  ad_account_id TEXT NOT NULL,
  store_id TEXT NOT NULL,
  evaluation_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  actor TEXT NOT NULL,
  mode TEXT NOT NULL,
  requested_at_utc TEXT NOT NULL,
  executed_at_utc TEXT,
  prior_status TEXT,
  meta_response_json TEXT,
  result TEXT NOT NULL,
  undo_token_hash TEXT,
  undo_expires_at_utc TEXT,
  undone_by_action_id TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_guard_action_undo ON guard_actions(undo_token_hash);
CREATE INDEX IF NOT EXISTS idx_guard_action_acct ON guard_actions(ad_account_id, requested_at_utc);

CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  dedupe_key TEXT NOT NULL,
  topic TEXT NOT NULL,
  shop_domain TEXT NOT NULL,
  api_version TEXT,
  triggered_at TEXT,
  received_at_utc TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  resource_gid TEXT,
  status TEXT NOT NULL DEFAULT 'RECEIVED',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  processed_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_dedupe ON webhook_events(dedupe_key);
CREATE INDEX IF NOT EXISTS idx_webhook_shop_topic ON webhook_events(shop_domain, topic, received_at_utc);

CREATE TABLE IF NOT EXISTS compliance_requests (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  shop_domain TEXT NOT NULL,
  shopify_customer_id TEXT,
  orders_requested_json TEXT NOT NULL DEFAULT '[]',
  payload_json TEXT NOT NULL DEFAULT '{}',
  received_at_utc TEXT NOT NULL,
  due_by_utc TEXT NOT NULL,
  completed_at_utc TEXT
);

CREATE TABLE IF NOT EXISTS utm_check_results (
  id TEXT PRIMARY KEY,
  ad_id TEXT NOT NULL,
  adset_id TEXT NOT NULL,
  ad_account_id TEXT NOT NULL,
  checked_at_utc TEXT NOT NULL,
  status TEXT NOT NULL,
  issues_json TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_utm_check_acct ON utm_check_results(ad_account_id, checked_at_utc);

CREATE TABLE IF NOT EXISTS job_runs (
  id TEXT PRIMARY KEY,
  job TEXT NOT NULL,
  scope_key TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  ok INTEGER,
  stats_json TEXT,
  error TEXT
);
CREATE INDEX IF NOT EXISTS idx_job_runs_scope ON job_runs(job, scope_key, started_at);
`;
