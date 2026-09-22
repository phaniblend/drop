# DropshipOS

Operator desk for dropshippers: product discovery, catalog/Shopify publish, order fulfillment, customer macros, supplier stock, and ad margin protection.

The app runs **fully in demo mode** with a local SQLite database. Live Shopify / Meta / TikTok / AliExpress / SerpApi / AI calls stay off until you add keys.

`https://github.com/phaniblend/drop` is empty — this repo is the implementation of `design-doc.html`, plus day-to-day ops tools existing dropshippers actually need.

## Run it

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Copy `env.example` to `.env.local` only when you have real credentials.

## What you can do today (no APIs)

- **Command** — today’s revenue, COGS, ad spend, net profit, alerts, 7-day chart, checklist
- **Discover** — scored supplier feed, URL import, CSV import (`public/sample-products.csv`)
- **Catalog** — drafts, unit economics after card fees, local copy cleaner, “publish” (local if Shopify is offline)
- **Orders / Fulfill** — unfulfilled queue, copy address, mark placed at supplier, paste tracking, batch CSV export
- **Ads & Guard** — circuit breaker using `Revenue − COGS − ad spend − (revenue × 2.9% + $0.30)`
- **Suppliers** — mapped SKUs and low-stock warnings
- **Daily ops** — WISMO macros, aging shipments, refund queue
- **Settings** — store defaults, integration status, reset demo data

Webhook (when Shopify is connected): `POST /api/webhooks/shopify`  
Cron: `GET /api/cron/margin-guard?secret=CRON_SECRET`

## What I need you to subscribe to / create

I cannot create paid developer accounts or buy proxies. Plug these into `.env.local` when you have them — the adapters already exist.

| You create | Env vars | Unlocks |
|---|---|---|
| Shopify custom app (Admin API, `write_products`, `read_orders`) | `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_ADMIN_TOKEN`, `SHOPIFY_WEBHOOK_SECRET` | Real product push + order ingest |
| Meta Marketing API token | `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID` | Live spend + pause |
| TikTok Marketing API | `TIKTOK_ACCESS_TOKEN`, `TIKTOK_ADVERTISER_ID` | Live spend + disable ad groups |
| AliExpress Dropshipper developer app | `ALIEXPRESS_APP_KEY`, `ALIEXPRESS_APP_SECRET`, `ALIEXPRESS_ACCESS_TOKEN` | Official catalog (preferred over scrape) |
| SerpApi | `SERPAPI_KEY` | Google Lens visual match from competitor ads |
| Google Gemini API | `GEMINI_API_KEY` | LLM title/description rewrite + ad angles |
| Optional Playwright + **residential proxies you pay for** | `ENABLE_HEADLESS_SCRAPE=true` | Headless supplier page parse (ToS/risk is on you) |
| Production DB (Neon Postgres or Turso) + Redis | `DATABASE_URL` | Replace local `data/dropshipos.db` |

Until those exist, everything you click is real against the local database — it just does not touch a live store or ad account.

## Stack

Next.js 16 App Router, React 19, Tailwind 4, SQLite via libSQL/Drizzle, server actions for mutations.
