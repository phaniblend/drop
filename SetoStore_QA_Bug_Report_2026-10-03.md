# SetoStore QA bug report

- **App:** https://www.seto.store/ (operator desk + storefront at `/s/seto`)
- **Tested:** Saturday 3 Oct 2026, two passes: about 8:26–8:35 PM CT and about 8:48–8:55 PM CT
- **Tester role:** a dropshipper evaluating the product before subscribing
- **Environment:** Chrome desktop, viewport 1060 × 586, signed in as the Superuser plan account
- **Account state:** Stripe in sandbox (no live keys), Meta connected, AliExpress connected, TikTok and Shopify not connected, 13 catalog products (9 published, 1 ready, 3 draft), 0 orders, 0 live campaigns

## Read this first

1. **The build changed between my two passes.** Two bugs from the first pass no longer reproduce, and the sample ad cards are gone from Ads & Guard. Every issue below carries a status: **Open** (reproduced in the second pass), **Fixed** (seen in pass 1, gone in pass 2) or **Unverifiable** (seen in pass 1, the screen that showed it no longer exists).
2. **One correction to my earlier summary.** I said the Pet Hair Remover was live at 0 stock. It is a **Draft** and does not appear on the storefront. The storefront also marks sold-out variants correctly. The real issue is narrower and is filed as SETO-10.
3. **Scope.** Testing was read-only. I did not import, publish, change pricing or settings, pause any ad, or run a checkout. See "Not tested" at the end.

## Summary

| ID | Severity | Status | Area | Issue |
|---|---|---|---|---|
| SETO-01 | High | Open | Discover | Card cost is exactly 2× the real cost; suggested sell price is inflated to match |
| SETO-02 | High | Open | Catalog / ad angles | Ad script quotes a stale price ("At just 10.41") for a $24.98 product |
| SETO-03 | Medium | Open | Command / Orders | Activity feed shows a paid checkout that exists nowhere else |
| SETO-04 | Medium | Open | Command / Ads & Guard | Organic-test gate locks Margin Guard for all 13 products, drafts included |
| SETO-05 | Medium | Open | Discover / Catalog | "Clean titles" badge sits over titles cut mid-phrase and still carrying supplier junk |
| SETO-06 | Medium | Open | Discover | 12 of 23 results have no cost; sort options rely on data the cards never show |
| SETO-07 | Medium | Open | Catalog product page | Published product shows "Mark ready" and an unchecked compliance box |
| SETO-08 | Medium | Open | Catalog product page | Two different meanings of "markup" and "cost" |
| SETO-09 | Medium | Open | Storefront | Supplier logos and brand names in images and titles; one image per product |
| SETO-10 | Medium | Open | Suppliers | "Products you sell" lists drafts and out-of-stock items with no status |
| SETO-11 | Medium | Open | Ads & Guard | No guidance on how a Meta ad set gets matched to a product; "dual-signal" copy assumes Shopify |
| SETO-12 | Low | Open | Discover | Score badge is unexplained and carries almost no information |
| SETO-13 | Low | Open | Catalog | No warning when a published product cannot be advertised profitably |
| SETO-14 | Low | Open | Settings / Pricing | Pricing page not linked from the app; plan quotas have no numbers |
| SETO-15 | Low | Open | Command | Status labels contradict each other |
| SETO-16 | Low | Open | Command | 7-day chart is a blank block when there is no data |
| SETO-17 | Low | Open | Storefront | Grammar error in the shipping policy |
| SETO-18 | Low | Open | Listing copy | Generated copy makes health-style claims with no policy warning |
| SETO-19 | Low | Open | Top bar | "Operator desk" label truncates at 1060px |
| SETO-F1 | High | Fixed | Command | Loss bar in 7-day chart rendered ~16,000px tall |
| SETO-F2 | High | Fixed | Command | Sample ad spend counted in real KPIs |
| SETO-U1 | Low | Unverifiable | Ads & Guard | "Why?" explanation written in developer language |
| SETO-U2 | Low | Unverifiable | Ads & Guard | Red "Pause locally" was the primary button on a healthy, winning ad |

---

## Open issues

### SETO-01 — Discover card cost is exactly 2× the real cost
**Severity:** High · **Status:** Open (reproduced in both passes) · **URL:** `/discover`

**Steps**
1. Open `/discover`, search `portable blender`, press Enter.
2. Note "Your cost" and "Suggested sell (3×)" on the first card.
3. Click **Preview (free)** on that card.

**Expected:** The card's cost matches the cost the preview reports, or is clearly labelled as a list price.

**Actual:** The preview itself admits the mismatch.

| Listing | Card cost | Preview "real cost" | Ratio | Card suggested sell |
|---|---|---|---|---|
| Portable Blender USB Rechargeable Electric Blender Cup… | $43.08 | $21.54 | 2.000 | $136.71 |
| New Cat Interactive Ball Toy Automatic Rolling Ball… (Pet chip) | $22.46 | $11.23–$25.54 (cheapest variant $11.23) | 2.000 | $74.85 |

Preview text, verbatim: `Real cost $21.54 (Discover card showed ~$43.08)· Ship unknown — enter after import· 28 pcs sellable`

**Technical notes**
- Card data comes from `POST /api/discover/search`. Preview data comes from `POST /api/scrape`.
- Both samples are off by exactly 2.000, which points to a field or arithmetic problem, not random promo pricing. Candidates: the search path reads the pre-discount/original price field while scrape reads the sale price; or a ×2 is applied somewhere in the feed mapping. I could not see the response bodies, so this is a hypothesis.
- Suggested sell is computed as `(card cost + $2.49 ship) × 3`: (43.08 + 2.49) × 3 = 136.71. So the error carries straight into the sell price, margin and break-even ROAS.
- The card's ship estimate is a flat `~$2.49` on every listing, while the preview says "Ship unknown".

**Suggested fix:** Map the card cost to the same price field the scrape uses (lowest in-stock variant sale price) and show it as "from $X". If the feed truly cannot provide it, show "Verify cost on import" instead of a wrong number.

**Acceptance:** For 20 sampled listings across 3 searches, card cost is within 5% of the preview's lowest variant cost, and the "(Discover card showed ~$X)" note no longer appears.

---

### SETO-02 — Ad angle quotes a stale price
**Severity:** High · **Status:** Open · **URL:** `/catalog/prod_76b9c54e-2` (Adjustable Breathable Posture Corrector Belt)

**Steps**
1. Open the product, scroll to "Ad creatives & hooks".
2. Read the third angle, "Highlights affordability for a daily solution".

**Expected:** The script quotes the current selling price, $24.98, with a currency symbol.

**Actual:** `Meet the Posture Corrector Belt. At just 10.41, it solves a daily annoyance.`

**Technical notes**
- Pricing fields on the same page: selling price `24.98`, markup `7.2`, ship `2.5`.
- 10.41 = 3 × $3.47, which is the base variant cost times the default 3× markup. The angle was most likely generated before the markup was raised to 7.2, and the price was baked into the text.
- "Post on Meta" and "Post on TikTok" copy this script, so the wrong price can reach a live ad. An ad price that differs from the landing-page price is also a Meta policy risk.
- The number has no currency symbol.

**Suggested fix:** Store the price as a placeholder (for example `{{price}}`) and resolve it at copy/post time, or mark angles stale and prompt a rewrite whenever "Save pricing" changes the price. Format with the store currency.

**Acceptance:** Change the selling price, save, reload. Every angle shows the new price with a currency symbol, or shows a "price changed, rewrite" prompt.

---

### SETO-03 — Activity feed shows a checkout that exists nowhere else
**Severity:** Medium · **Status:** Open · **URL:** `/` (Feed → Activity), `/orders`

**Steps**
1. Open `/`, scroll to "Feed / Activity". First row reads `Store checkout buyer@example.com paid 16.44.`
2. Click **View** on that row. It goes to `/orders`.

**Expected:** The order is listed, or the feed row is not there.

**Actual:** `/orders` shows "No orders yet. When a shopper pays on your store, it shows up here." The dashboard's "Latest checkouts" says "No checkouts yet." and revenue is $0.00 with 0 orders.

**Technical notes:** Likely a seeded or test event, or an order that was cleared without its feed entry. `buyer@example.com` suggests seed data. The amount has no currency symbol. No product in the catalog is priced at $16.44 (nearest is $15.99).

**Suggested fix:** Remove seed events from real workspaces, or tag them "Sample". Delete or tombstone feed entries when their order is removed. Link the row to the specific order, not the list.

**Acceptance:** Every "Store checkout" feed row resolves to an order record.

---

### SETO-04 — Organic-test gate locks Margin Guard for every product, drafts included
**Severity:** Medium (product decision plus a bug) · **Status:** Open · **URL:** `/` (Triage, "Before paid spend")

**Actual**
- "3-video organic test" shows **13 LOCKED**, one block per catalog product, each needing three videos at 1,000+ organic views before "Margin Guard & Paid Launch" unlocks. Each block has an **Override** button (13 on the page).
- Triage, titled "What will lose money if you ignore it", lists "Organic test still open" WARN rows for **Dimmable RGB LED Puck Light** and **Waterproof Compression Sleeping Bag Stuff Sack**. Both are Drafts. A draft cannot lose money.
- The 13 blocks make the dashboard about 6,800px tall and push Orders, Catalog and Feed far below the fold.

**Why it matters:** A merchant who already runs ads and wants margin protection today meets a wall. Margin Guard is the product's main selling point, and the pricing page promises "Live Margin Guard on connected Meta ads" on Starter with no mention of the gate.

**Suggested fix**
- Bug part: only raise organic-test triage rows and lock blocks for Published products (or products with an ad attached).
- Product part: make the gate opt-in, or a single account-level setting, and collapse the per-product blocks into one compact list.

**Acceptance:** Draft products produce no triage rows. A merchant with an existing ad set can turn Guard on without recording videos, or the pricing page states the requirement.

---

### SETO-05 — "Clean titles" badge over titles that are not clean
**Severity:** Medium · **Status:** Open · **URL:** `/discover`, `/catalog`, `/s/seto`

**Actual**
- Card headings are cut at a fixed length, ending on a dangling word:
  - `Portable Blender USB Rechargeable Electric Blender Cup for`
  - `Local Stock New Portable Juice Maker Blender for`
  - `Portable Blender USB Rechargeable Juicer Cup 400ml 6`
  - `2-Cup Multi-Functional Electric Juicer, Blender, Juicer With 6`
- The badge tooltip says: "Supplier junk (ships-from, warehouse labels) is stripped so the catalog title is shopper-ready." Yet `Local Stock`, `Top Rated 2026` and `2026 Hot Selling Items` survive.
- The same pattern reaches the live storefront: `2026 New Portable Waist Fan With Power`, `Jessup Makeup Brushes Set 15pcs Professional Makeup`, `8000mah Usb Hanging Neck Fan Portable Bladeless`.

**Suggested fix:** Truncate on a word boundary and drop trailing stop-words and bare numbers. Add `Local Stock`, year prefixes, `Hot Selling`, `Top Rated` and `New` to the strip list. Normalise casing (`8000mAh`, `USB`).

**Acceptance:** No card or storefront title ends in a preposition, conjunction or bare number, and none contains the stripped phrases.

---

### SETO-06 — Half the results are unpriced; sort options use data the cards do not show
**Severity:** Medium · **Status:** Open · **URL:** `/discover`

**Actual**
- Search `portable blender` returns 23 listings. 11 have a cost. 12 show `—` / "Verify cost on import" / "Margin on import".
- Sort offers "Most sold" and "Fastest ship", but no card shows a sold count or a delivery time, so the result of those sorts cannot be checked.
- "Priced only", "4★+" and "In stock" filters exist and default to off, while every card says "Confirm stock on import".

**Suggested fix:** Default "Priced only" to on, or enrich unpriced cards lazily through the scrape endpoint. Show sold count and ship days on the card when the sort uses them.

---

### SETO-07 — Published product shows "Mark ready" and an unchecked compliance box
**Severity:** Medium · **Status:** Open · **URL:** `/catalog/prod_76b9c54e-2`

**Actual:** The product is PUBLISHED (badge on the page, live at `/s/seto/prod_76b9c54e-2`). The Supplier panel still offers **Mark ready**, which is an earlier state. The checkbox **"I checked this listing is allowed"** is unchecked.

**Open question for the developer:** Is the compliance checkbox enforced at publish and simply not persisted on reload, or is it not enforced at all? I did not run the publish flow, so I cannot say which.

**Suggested fix:** Hide or disable state buttons that do not apply to the current status. Persist the compliance confirmation with a timestamp and require it before publish.

---

### SETO-08 — "Markup" and "cost" mean different things on different screens
**Severity:** Medium · **Status:** Open · **URL:** `/discover`, `/catalog/prod_76b9c54e-2`

**Actual**
- Discover: "Suggested sell (3×)" = (cost + ship) × 3.
- Product page: markup `7.2` × base variant cost $3.47 = $24.98. Shipping ($2.50) is excluded from the multiplied base.
- Product page header shows "Your cost $5.97" (= $3.47 + $2.50), while the Options table lists variant costs from $3.36 to $3.82 and variant prices from $24.19 to $27.50.
- The storefront shows one price, $24.98, with no price next to the options.

**Open question:** When a shopper picks M · black (table price $27.50), are they charged $27.50 or $24.98? If $24.98, margin on that variant is lower than the page claims. I did not add to bag, so this needs a check.

**Suggested fix:** Pick one definition (landed cost = item + ship is the safer base) and use it on both screens. Label "Your cost" as "landed cost" and show the item/ship split. If variants have different prices, show them on the storefront.

---

### SETO-09 — Supplier branding on the storefront; one image per product
**Severity:** Medium · **Status:** Open · **URL:** `/s/seto`, `/s/seto/prod_76b9c54e-2`

**Actual**
- Product images carry supplier logos: `ZINGPENG` (posture belt), `JPNPL` (neck fan), `Jessup` (makeup brushes).
- A third-party brand name is in a live title: "Jessup Makeup Brushes Set…".
- The product page renders a single image, with no gallery.

**Why it matters:** Branded imagery and brand names are a common reason for ad rejections and takedown requests, and the app gives no warning at import or publish.

**Suggested fix:** Flag listings whose title contains a likely brand token, and warn before publish. Import the supplier's full image set and let the operator pick the hero image.

---

### SETO-10 — Suppliers page lists drafts and out-of-stock products as "Products you sell"
**Severity:** Medium · **Status:** Open · **URL:** `/suppliers`

**Actual:** "Products you sell" lists all 13 catalog products with cost, delivery window and stock, and no status column. It includes **Pet Hair Remover Roller Dog Cat — 0 pcs**, which is a Draft and not on the storefront. The "5 LOW STOCK" badge counts drafts too (belt 29, stuff sack 17, phone mount 23, pet hair remover 0, phone holder 15), while the dashboard triage lists only the three published ones.

This misled me into reporting an out-of-stock product as live, so it will mislead operators.

**Other copy on this page:** the supplier card says "Linked from catalog repair", which is internal language.

**Suggested fix:** Add a status column, default the list to Published, and make the low-stock badge match the triage count.

---

### SETO-11 — No guidance on how an ad set is matched to a product
**Severity:** Medium · **Status:** Open · **URL:** `/ads`, `/settings`

**Actual**
- With Meta connected and no campaigns, the page says only: "Meta connected — no active campaigns yet. Create an ad set in Ads Manager, then check again."
- Nothing says how Seto will tie that ad set to a product and its cost (naming convention, UTM, product picker).
- Settings describes Guard as "Dual-signal Guard (Meta + Shopify contribution)", while Shopify is listed as "Optional. You do not need Shopify — your Seto store is included." It is unclear what the second signal is for a Seto-store-only merchant.
- Plan card reads "Margin Guard 0 / ∞ campaigns" with no way to add one from the app.

**Suggested fix:** Add a short "how attribution works" block on `/ads` with the exact UTM or naming rule, plus a manual "link ad set to product" control as a fallback. Reword the dual-signal copy to cover the Seto-store case.

---

### SETO-12 — Score badge is unexplained
**Severity:** Low · **Status:** Open · **URL:** `/discover`

**Actual:** Each card has a bare number (`39`, `29`, or `—`) with only a hover tooltip, "Score from margin, rating". Because every card uses the same 3× markup, margin is about 63% everywhere, so the score appears to track rating only: rated listings show 39, unrated ones show 29. The scale is not stated.

**Suggested fix:** Label it ("Score 39/100"), and feed it real differentiators (orders sold, ship time, real cost) or remove it.

---

### SETO-13 — No warning on a product that cannot be advertised profitably
**Severity:** Low · **Status:** Open · **URL:** `/catalog`

**Actual:** Cat Corner Self-Grooming Brush is PUBLISHED at $5.70 on a $3.40 cost: 32.1% margin, $1.83 profit per unit, which works out to a break-even ROAS of about 3.1x. The row gets an amber margin chip and nothing else.

**Suggested fix:** Warn at publish when profit per unit is under a threshold (for example $8) or break-even ROAS is above about 2.5x.

---

### SETO-14 — Pricing is not reachable from the app and has no numbers
**Severity:** Low · **Status:** Open · **URL:** `/settings`, `/pricing`

**Actual**
- `/settings` has no link to `/pricing`, billing or upgrade. The Billing card says "Takes the Starter or Scaler upgrade after the free trial." with no button.
- `/pricing` lists Free $0, Starter $19/mo, Scaler $39/mo. Starter says "Higher monthly import quota"; Scaler says "Largest import quota" and "More ad sets under Guard". Only the free tier gives a number (5 imports).

**Suggested fix:** Link the plan card to `/pricing`, and state imports per month and ad sets guarded for each tier.

---

### SETO-15 — Status labels contradict each other
**Severity:** Low · **Status:** Open · **URL:** `/`, `/settings`

**Actual, all visible at once**
- Dashboard header: "Store: Setup needed | Stripe: Not connected | Ad Tracking: Ready | Setup: 3/5".
- Top bar: green **CONNECTED** badge.
- Sidebar: "3 live connections · Checkout off".
- Settings: "Your store — CONNECTED".

**Suggested fix:** Say what is connected. Replace the top-bar badge with "3 of 5 connected", or drop it.

---

### SETO-16 — 7-day chart is blank with no data
**Severity:** Low · **Status:** Open (new after the SETO-F1 fix) · **URL:** `/`

**Actual:** With zero revenue all week, every bar now has inline `height:0%`, so "Revenue vs net" shows only day labels under a tall empty card. There is no legend and no axis.

**Suggested fix:** Show an empty state ("No sales in the last 7 days") or a minimum bar height, and add a legend for revenue, profit and loss colours.

---

### SETO-17 — Grammar error in the shipping policy
**Severity:** Low · **Status:** Open · **URL:** `/s/seto/shipping`

**Actual:** "We buy from the supplier after you pay and **sends** tracking when the parcel ships."
**Fix:** "…and **send** tracking when the parcel ships."

---

### SETO-18 — Generated copy makes health-style claims with no policy warning
**Severity:** Low · **Status:** Open · **URL:** `/catalog/prod_76b9c54e-2`, `/catalog`

**Actual:** Storefront and ad copy for the posture belt includes "helping to alleviate discomfort from slouching" and "encourages proper spinal alignment". The catalog also holds "Omega 3 Fish Oil for Daily Wellness" in READY. Both categories are sensitive on Meta and TikTok. The only safeguard is the generic "I checked this listing is allowed" box (see SETO-07).

**Suggested fix:** Detect health, supplement and medical-device categories at import, tone down generated claims for them, and show a specific warning.

---

### SETO-19 — Top-bar label truncates
**Severity:** Low · **Status:** Open · **URL:** all desk pages

**Actual:** At 1060px wide the top-left label renders as "Operator …" or "Operator de…", and the width changes from page to page.
**Fix:** Shorten the label or let the user chip shrink first.

---

## Fixed between passes (keep as regression tests)

### SETO-F1 — Loss bar in the 7-day chart rendered about 16,000px tall
**Severity:** High · **Status:** Fixed in pass 2 · **URL:** `/`

**Pass 1:** A red vertical stripe ran down the whole dashboard at about x = 722px, covering text in the checklist, KPI tiles and triage. The element was `div.w-3.rounded-sm.bg-loss/80` with a rendered height of **16,063px** inside a `main` that was 6,794px tall. It was Sunday's net bar. The other bars had inline `height: 8%`.

**Trigger data:** revenue $0.00, net profit −$125.50 for the day.

**Likely cause:** Bar height derived from |net| divided by the week's maximum revenue, which was 0, with no clamp.

**Pass 2:** Bars now carry `max-h-full` and inline `height:0%`. The stripe is gone.

**Regression test:** Seed a day with revenue 0 and net −125.50. No bar may exceed its chart container, and the document height must not change.

### SETO-F2 — Sample ad spend counted in real KPIs
**Severity:** High · **Status:** Fixed in pass 2 · **URL:** `/`, `/ads`

**Pass 1:** Dashboard showed Ad spend **$125.50**, Net profit **−$125.50**, margin "0.0%", with 0 orders. $125.50 is the sum of the three DEMO ad cards then on `/ads` ($42.50 + $28.00 + $55.00). Triage also showed "SAMPLE — Hook A (losing) is burning margin" as a real LOSS row.

**Pass 2:** Ad spend $0.00, Net profit $0.00, no SAMPLE triage row, no sample cards on `/ads`.

**Regression test:** With sample ads present, KPI tiles, triage and the 7-day chart must exclude any record flagged as demo. Also show "—" for margin when revenue is 0.

**Follow-up:** `/pricing` still lists "Sample Ads & Guard walkthrough" under the free trial. Confirm new accounts still get it, clearly separated from real numbers.

---

## Seen in pass 1, no longer reproducible

The sample ad cards that showed these were removed in pass 2. If real ad sets use the same card component, the issues may still be there.

### SETO-U1 — "Why?" answers in developer language
Clicking **Why?** on the sample losing ad returned: "No dual-signal evaluation yet — it runs on the hourly cron after Meta insights sync."
**Suggested copy:** "Not checked yet. The next automatic check runs within the hour."
For contrast, **Preview pause** was clear: "Would pause: spend reached $42.50 and the first clicks look too expensive or too few. Preview only — no ad was paused."

### SETO-U2 — Red "Pause locally" was the primary button on a healthy ad
The sample winner (5.57x sales per ad dollar, status HEALTHY) had a solid red **Pause locally** as its most prominent control, next to outline buttons for Why?, Preview pause and Check ads. A destructive action should not be the default on a winning ad.
The same card also showed a "Paid launch locked" banner while reporting spend and revenue, which contradicts itself.

---

## Not tested

- Checkout (Add to bag through payment), order creation, fulfilment, tracking paste, refunds.
- Import to catalog, publish, "Save pricing", "Update on your store", "Rewrite title & bullets", "Write ad angles".
- A real Margin Guard pause, Guard modes, early kill-switch save, Override on the organic gate.
- Shopify, TikTok and Stripe connection flows, "Install SetoStore", "Repair catalog", "Clear workspace".
- Mobile and tablet widths, other browsers, signed-out pages other than `/pricing`.
- One unconfirmed observation: a screenshot of the Discover results grid failed three times in pass 1 and worked on other pages. The grid loads supplier images through `/api/media`. This may be image weight or may be unrelated to the app; I could not determine the cause.
