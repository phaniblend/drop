import "server-only";

function read(name: string) {
  return process.env[name]?.trim() || "";
}

export function integrationStatus() {
  const shopify = Boolean(
    read("SHOPIFY_STORE_DOMAIN") &&
      (read("SHOPIFY_ADMIN_TOKEN") || (read("SHOPIFY_CLIENT_ID") && read("SHOPIFY_CLIENT_SECRET"))),
  );
  const meta = Boolean(read("META_ACCESS_TOKEN"));
  const tiktok = Boolean(read("TIKTOK_ACCESS_TOKEN"));
  // Official Open API keys — HTML Discover still works without these.
  const aliexpress = Boolean(read("ALIEXPRESS_APP_KEY") && read("ALIEXPRESS_APP_SECRET"));
  const cj = Boolean(read("CJ_API_KEY"));
  const serp = Boolean(read("SERPAPI_KEY"));
  const ai = Boolean(read("GEMINI_API_KEY") || read("GOOGLE_AI_API_KEY"));
  const scrape = true;
  // Discover is always "live capable" via public AliExpress HTML (+ CJ/API when keyed).
  const discover = true;

  return {
    shopify,
    meta,
    tiktok,
    aliexpress,
    cj,
    serp,
    ai,
    scrape,
    discover,
    demo: false,
    liveCount: [shopify, meta, tiktok, true, cj, serp, ai].filter(Boolean).length,
  };
}

export const env = {
  databaseUrl: read("DATABASE_URL"),
  shopifyDomain: read("SHOPIFY_STORE_DOMAIN").replace(/\.myshopify\.com$/i, ""),
  shopifyToken: read("SHOPIFY_ADMIN_TOKEN"),
  shopifyClientId: read("SHOPIFY_CLIENT_ID"),
  shopifyClientSecret: read("SHOPIFY_CLIENT_SECRET"),
  shopifyWebhookSecret: read("SHOPIFY_WEBHOOK_SECRET"),
  metaToken: read("META_ACCESS_TOKEN"),
  metaAdAccountId: read("META_AD_ACCOUNT_ID"),
  tiktokToken: read("TIKTOK_ACCESS_TOKEN"),
  tiktokAdvertiserId: read("TIKTOK_ADVERTISER_ID"),
  aliexpressAppKey: read("ALIEXPRESS_APP_KEY"),
  aliexpressAppSecret: read("ALIEXPRESS_APP_SECRET"),
  aliexpressAccessToken: read("ALIEXPRESS_ACCESS_TOKEN"),
  cjApiKey: read("CJ_API_KEY"),
  serpApiKey: read("SERPAPI_KEY"),
  geminiApiKey: read("GEMINI_API_KEY") || read("GOOGLE_AI_API_KEY"),
  geminiModel: read("GEMINI_MODEL") || "gemini-2.0-flash",
  enableHeadlessScrape: read("ENABLE_HEADLESS_SCRAPE") === "true",
  cronSecret: read("CRON_SECRET"),
  stripeSecretKey: read("STRIPE_SECRET_KEY"),
  stripeWebhookSecret: read("STRIPE_WEBHOOK_SECRET"),
  stripePriceStarter: read("STRIPE_PRICE_STARTER"),
  stripePriceScaler: read("STRIPE_PRICE_SCALER"),
  appUrl: read("APP_URL") || "http://localhost:3000",
  authSecret: read("AUTH_SECRET"),
  googleId: read("AUTH_GOOGLE_ID") || read("GOOGLE_CLIENT_ID"),
  googleSecret: read("AUTH_GOOGLE_SECRET") || read("GOOGLE_CLIENT_SECRET"),
};
