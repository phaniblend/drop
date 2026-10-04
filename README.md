# DropshipOS / SetoStore

Operator desk for dropshippers: product discovery, catalog/Shopify publish, order fulfillment, customer macros, supplier stock, and ad margin protection.

Production: [https://www.seto.store](https://www.seto.store) (apex `seto.store` should **301/308** to `www` via GoDaddy HTTPS forward).

## Run it

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Copy `env.example` to `.env.local` when you have credentials.

## Go-live checklist (Seto platform)

See **Settings → Seto launch** for live status. Soft launch does **not** require merchant Stripe.

1. **Railway env** — `AUTH_*`, `APP_URL`, `CRON_SECRET`, `META_APP_ID`, `META_APP_SECRET`, `ENCRYPTION_KEY`.
2. **Cron** — cron-job.org hourly `GET /api/cron/hourly` with `Authorization: Bearer CRON_SECRET`.
3. **Meta** — Settings → Connect with Facebook (testers OK in Development). App Review only when public customers need Login. URLs: `/privacy`, `/api/meta/callback`, `/api/meta/data-deletion`.
4. **Platform Stripe (paid Seto plans)** — live `STRIPE_SECRET_KEY` (`sk_live_…`), `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_SCALER`, webhook → `/api/webhooks/stripe`. Soft launch can skip this.
5. **Smoke path** — Settings → **Create practice order** → Fulfill → add tracking. Optional: seller test Stripe + one Stripe test-card checkout on `/s/{slug}`.
6. **Health** — `GET /api/health` returns `softLaunchOk` / `chargePlansOk` (no secrets).

## Env vars (Railway / `.env.local`)

| Var | Required? | Status screen |
|---|---|---|
| `APP_URL` | Prod required (`https://www.seto.store`) | Shopify OAuth redirect |
| `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Required for login | Login |
| `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET` | Required for Connect | Settings → Shopify |
| `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_ADMIN_TOKEN` | Optional fallback | Settings → Shopify |
| `SHOPIFY_WEBHOOK_SECRET` | Optional (HMAC) | Webhooks |
| `META_ACCESS_TOKEN` | Optional if using Meta Login | Settings → Meta / Ads |
| `META_AD_ACCOUNT_ID` | Fallback when Login not used | Settings → Meta / Ads |
| `META_APP_ID`, `META_APP_SECRET` | Required for Login + Extend ~60d | Settings → Connect with Facebook |
| `ENCRYPTION_KEY` | Required to encrypt Meta tokens at rest | Meta Login |
| `MARGIN_GUARD_AUTOPAUSE_ENABLED` | Optional (`false` kills auto-pause host-wide) | Settings → Margin Guard |
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
