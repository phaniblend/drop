import "server-only";

import fs from "node:fs";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";
import { seedIfEmpty } from "./seed";

type DB = LibSQLDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  dropshipClient?: Client;
  dropshipDb?: DB;
  dropshipReady?: Promise<DB>;
};

function fileUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "dropshipos.db").replaceAll("\\", "/");
  return `file:${file}`;
}

function getClient() {
  if (!globalForDb.dropshipClient) {
    const authToken =
      process.env.TURSO_AUTH_TOKEN?.trim() || process.env.LIBSQL_AUTH_TOKEN?.trim() || "";
    globalForDb.dropshipClient = createClient({
      url: fileUrl(),
      ...(authToken ? { authToken } : {}),
    });
  }
  return globalForDb.dropshipClient;
}

export function getDb() {
  if (!globalForDb.dropshipDb) {
    globalForDb.dropshipDb = drizzle(getClient(), { schema });
  }
  return globalForDb.dropshipDb;
}

const DDL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL DEFAULT 'Operator',
  store_name TEXT NOT NULL DEFAULT 'SetoStore',
  shopify_domain TEXT,
  shopify_access_token TEXT,
  meta_access_token TEXT,
  tiktok_access_token TEXT,
  markup_multiplier REAL NOT NULL DEFAULT 3,
  spend_limit_threshold REAL NOT NULL DEFAULT 50,
  min_roas_threshold REAL NOT NULL DEFAULT 1.2,
  fee_rate REAL NOT NULL DEFAULT 0.029,
  fee_fixed REAL NOT NULL DEFAULT 0.3,
  timezone TEXT NOT NULL DEFAULT 'America/Chicago',
  sentinel_settings TEXT NOT NULL DEFAULT '{"enabled":true,"hookSpend":5,"minCtr":1.5,"maxCpc":1.8,"intentSpend":15}',
  dayparting_enabled INTEGER NOT NULL DEFAULT 0,
  subscription_tier TEXT NOT NULL DEFAULT 'trial_5',
  subscription_status TEXT NOT NULL DEFAULT 'active',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  products_imported_count INTEGER NOT NULL DEFAULT 0,
  lens_searches_count INTEGER NOT NULL DEFAULT 0,
  billing_cycle_start TEXT,
  billing_cycle_end TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shopify_product_id TEXT UNIQUE,
  supplier_source TEXT NOT NULL DEFAULT 'aliexpress',
  supplier_url TEXT NOT NULL,
  supplier_name TEXT NOT NULL DEFAULT 'AliExpress',
  raw_title TEXT NOT NULL,
  clean_title TEXT,
  description_html TEXT,
  tags TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  gallery_json TEXT NOT NULL DEFAULT '[]',
  base_cost REAL NOT NULL,
  shipping_cost REAL NOT NULL DEFAULT 0,
  retail_price REAL NOT NULL,
  markup_multiplier REAL NOT NULL DEFAULT 3,
  shipping_days INTEGER NOT NULL DEFAULT 14,
  status TEXT NOT NULL DEFAULT 'draft',
  niche TEXT NOT NULL DEFAULT 'general',
  organic_status TEXT NOT NULL DEFAULT 'pending',
  organic_views_json TEXT NOT NULL DEFAULT '[0,0,0]',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS product_variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  shopify_variant_id TEXT UNIQUE,
  supplier_sku_id TEXT NOT NULL,
  variant_name TEXT NOT NULL,
  variant_cost REAL NOT NULL,
  variant_price REAL NOT NULL,
  inventory_count INTEGER NOT NULL DEFAULT 0,
  supplier_image_url TEXT,
  clean_image_url TEXT
);
CREATE TABLE IF NOT EXISTS campaign_trackers (
  id TEXT PRIMARY KEY,
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  ad_account_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  ad_set_id TEXT NOT NULL,
  ad_set_name TEXT,
  spend_limit_threshold REAL NOT NULL DEFAULT 50,
  min_roas_threshold REAL NOT NULL DEFAULT 1.2,
  spend_today REAL NOT NULL DEFAULT 0,
  revenue_today REAL NOT NULL DEFAULT 0,
  orders_count INTEGER NOT NULL DEFAULT 0,
  is_paused INTEGER NOT NULL DEFAULT 0,
  impressions REAL NOT NULL DEFAULT 0,
  clicks REAL NOT NULL DEFAULT 0,
  add_to_cart_count INTEGER NOT NULL DEFAULT 0,
  pause_reason TEXT,
  pause_source TEXT,
  last_polled_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shopify_order_id TEXT UNIQUE NOT NULL,
  order_number TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  shipping_address TEXT NOT NULL,
  total_revenue REAL NOT NULL,
  total_cogs REAL NOT NULL,
  payment_fee REAL NOT NULL,
  net_margin REAL NOT NULL,
  fulfillment_status TEXT NOT NULL DEFAULT 'pending_batch',
  supplier_order_id TEXT,
  tracking_number TEXT,
  carrier TEXT,
  notes TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT,
  variant_id TEXT,
  title TEXT NOT NULL,
  sku TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL,
  unit_cost REAL NOT NULL,
  supplier_url TEXT
);
CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'aliexpress',
  store_url TEXT,
  avg_shipping_days INTEGER NOT NULL DEFAULT 14,
  reliability REAL NOT NULL DEFAULT 0.9,
  notes TEXT
);
CREATE TABLE IF NOT EXISTS cs_macros (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS daily_tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  detail TEXT,
  done INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  for_date TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS refunds (
  id TEXT PRIMARY KEY,
  order_id TEXT,
  reason TEXT NOT NULL,
  amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS activity_log (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  message TEXT NOT NULL,
  href TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_products_user ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_trackers_adset ON campaign_trackers(ad_set_id);
CREATE INDEX IF NOT EXISTS idx_orders_fulfillment ON orders(fulfillment_status);
CREATE INDEX IF NOT EXISTS idx_users_subscription ON users(id, subscription_tier, products_imported_count);
`;

async function addMissingColumns(
  client: Client,
  table: string,
  columns: Array<[string, string]>,
) {
  const info = await client.execute(`PRAGMA table_info(${table})`);
  const names = new Set(
    info.rows.map((row) => String((row as { name?: string }).name ?? (row as unknown as string[])[1] ?? "")),
  );
  for (const [name, ddl] of columns) {
    if (!names.has(name)) {
      try {
        await client.execute(`ALTER TABLE ${table} ADD COLUMN ${name} ${ddl}`);
      } catch {
        /* column may already exist */
      }
    }
  }
}

async function migrateUsersBilling(client: Client) {
  await addMissingColumns(client, "users", [
    ["subscription_tier", "TEXT NOT NULL DEFAULT 'trial_5'"],
    ["subscription_status", "TEXT NOT NULL DEFAULT 'active'"],
    ["stripe_customer_id", "TEXT"],
    ["stripe_subscription_id", "TEXT"],
    ["products_imported_count", "INTEGER NOT NULL DEFAULT 0"],
    ["lens_searches_count", "INTEGER NOT NULL DEFAULT 0"],
    ["billing_cycle_start", "TEXT"],
    ["billing_cycle_end", "TEXT"],
    [
      "sentinel_settings",
      `TEXT NOT NULL DEFAULT '{"enabled":true,"hookSpend":5,"minCtr":1.5,"maxCpc":1.8,"intentSpend":15}'`,
    ],
    ["dayparting_enabled", "INTEGER NOT NULL DEFAULT 0"],
  ]);
}

async function migrateAdProtection(client: Client) {
  await addMissingColumns(client, "products", [
    ["organic_status", "TEXT NOT NULL DEFAULT 'pending'"],
    ["organic_views_json", "TEXT NOT NULL DEFAULT '[0,0,0]'"],
  ]);
  await addMissingColumns(client, "campaign_trackers", [
    ["impressions", "REAL NOT NULL DEFAULT 0"],
    ["clicks", "REAL NOT NULL DEFAULT 0"],
    ["add_to_cart_count", "INTEGER NOT NULL DEFAULT 0"],
    ["pause_reason", "TEXT"],
    ["pause_source", "TEXT"],
  ]);
}

export async function ensureDb() {
  if (!globalForDb.dropshipReady) {
    globalForDb.dropshipReady = (async () => {
      const client = getClient();
      await client.executeMultiple(DDL);
      await migrateUsersBilling(client);
      await migrateAdProtection(client);
      const db = getDb();
      await seedIfEmpty(db);
      return db;
    })();
  }
  return globalForDb.dropshipReady;
}

export async function resetReadyCache() {
  globalForDb.dropshipReady = undefined;
}
