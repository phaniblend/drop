# DropshipOS / SetoStore

Operator desk for dropshippers: product discovery, catalog/Shopify publish, order fulfillment, customer macros, supplier stock, and ad margin protection.

Production: [https://www.seto.store](https://www.seto.store) (apex `seto.store` should **301/308** to `www` via GoDaddy HTTPS forward).

## Run it

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Copy `env.example` to `.env.local` when you have credentials.

## Go-live checklist

1. **Shopify** — Settings → Connect Shopify (or env fallback). Turn **storefront password off** (Admin → Online Store → Preferences).
2. **Meta** — `META_AD_ACCOUNT_ID` + long-lived token (`META_APP_ID`/`META_APP_SECRET` → Settings → Extend Meta token). Status must be **Connected**, not Needs setup.
3. **One test order** through Shopify checkout → Orders → Fulfill → tracking → Command KPIs move.
4. **One Preview pause** on Ads & Guard against a real campaign (Preview never calls pause APIs).
5. **Cron** — cron-job.org hourly `GET /api/cron/hourly` with `Authorization: Bearer CRON_SECRET`.
6. **Railway** — health check path `/api/health`; prefer min replicas = 1 to avoid ~8s cold starts.

## Env vars (Railway / `.env.local`)

| Var | Required? | Status screen |
|---|---|---|
| `APP_URL` | Prod required (`https://www.seto.store`) | Shopify OAuth redirect |
| `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Required for login | Login |
| `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET` | Required for Connect | Settings → Shopify |
| `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_ADMIN_TOKEN` | Optional fallback | Settings → Shopify |
| `SHOPIFY_WEBHOOK_SECRET` | Optional (HMAC) | Webhooks |
| `META_ACCESS_TOKEN` | Required for Meta | Settings → Meta / Ads |
| `META_AD_ACCOUNT_ID` | Required for Connected (else Needs setup) | Settings → Meta / Ads |
| `META_APP_ID`, `META_APP_SECRET` | Required to extend token ~60d | Settings → Extend Meta |
| `TIKTOK_ACCESS_TOKEN`, `TIKTOK_ADVERTISER_ID` | Optional | Settings → TikTok |
| `ALIEXPRESS_APP_KEY`, `ALIEXPRESS_APP_SECRET` | Optional enrich | Settings → AliExpress |
| `CJ_API_KEY` | Optional | Settings → CJ |
| `SERPAPI_KEY` | Optional | Settings → SerpApi / Discover |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Optional (offline copy fallback) | Settings → Listing copy |
| `CRON_SECRET` | Required in prod | Cron routes (401 without it) |
| `DATABASE_URL` | Optional (else local SQLite) | — |
| `STRIPE_*` | Optional billing | Settings → Billing |

## What works without paid APIs

- Command, Discover (public HTML search), Catalog drafts, Orders/Fulfill desk, Ads Guard preview (sample rows), Settings

Webhook: `POST /api/webhooks/shopify`  
Cron: `GET /api/cron/hourly` and `GET /api/cron/margin-guard` with Bearer `CRON_SECRET`

## Stack

Next.js App Router, React, Tailwind, SQLite via libSQL/Drizzle, server actions + `/api` routes. Hosted on Railway (not Vercel).
