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
  const aliexpress = Boolean(read("ALIEXPRESS_APP_KEY") && read("ALIEXPRESS_APP_SECRET"));
  const serp = Boolean(read("SERPAPI_KEY"));
  const ai = Boolean(read("AI_GATEWAY_API_KEY"));
  const scrape = true;

  return {
    shopify,
    meta,
    tiktok,
    aliexpress,
    serp,
    ai,
    scrape,
    demo: !shopify && !meta && !tiktok && !aliexpress && !serp,
    liveCount: [shopify, meta, tiktok, aliexpress, serp, ai].filter(Boolean).length,
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
  serpApiKey: read("SERPAPI_KEY"),
  aiGatewayKey: read("AI_GATEWAY_API_KEY"),
  aiModel: read("AI_GATEWAY_MODEL") || "anthropic/claude-sonnet-4.6",
  enableHeadlessScrape: read("ENABLE_HEADLESS_SCRAPE") === "true",
  cronSecret: read("CRON_SECRET"),
  stripeSecretKey: read("STRIPE_SECRET_KEY"),
  stripeWebhookSecret: read("STRIPE_WEBHOOK_SECRET"),
  stripePriceStarter: read("STRIPE_PRICE_STARTER"),
  stripePriceScaler: read("STRIPE_PRICE_SCALER"),
  appUrl: read("APP_URL") || (read("VERCEL_URL") ? `https://${read("VERCEL_URL")}` : "http://localhost:3000"),
  authSecret: read("AUTH_SECRET"),
  googleId: read("AUTH_GOOGLE_ID") || read("GOOGLE_CLIENT_ID"),
  googleSecret: read("AUTH_GOOGLE_SECRET") || read("GOOGLE_CLIENT_SECRET"),
};
