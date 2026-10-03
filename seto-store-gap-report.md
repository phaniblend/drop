# SetoStore gap report: from pre-launch to "the" dropshipper tool

**Tested:** 2 October 2026, on www.seto.store, signed in to the "Akshara Setty" trial store, acting as a dropshipper.
**Path walked:** Discover → import → price → publish → storefront → bag → Stripe checkout form.
**Verdict:** not ready for production. 9 launch blockers, listed in section 2.

## How to read this

- **P0** = must fix before any paying customer. **P1** = needed for the product to be complete. **P2** = polish or growth.
- **Observed** = I saw it in the test. **Recommended** = my suggestion, not something I saw broken. **Untested** = I could not reach it.
- Each gap has an ID so you can track it.

### What I could not test

| Area | Why |
|---|---|
| Payment → order → fulfilment → tracking → refund | I can't enter card details on a live site, even Stripe test cards. Needs one sandbox order placed by you. |
| Meta sign-in and a real Margin Guard pause | Token expired; reconnecting grants account permissions, which is yours to approve. |
| Shopify connect, upgrade purchase, "Rewrite title & bullets", CSV/URL import, Saved listings | Not exercised in this run. |
| Logged-out landing page, sign-up, mobile layout | I was already signed in on a desktop-width window. |
| Pixel events, order emails, webhooks | No pixel set and no order placed. |

---

## 1. Strategic note first

Seto currently presents two products at once: a **built-in store** (catalog, storefront, checkout, fulfilment) and **Margin Guard** (ad-spend protection). Most gaps below sit in the built-in store. Margin Guard, the part you plan to charge for, could not run at all in this test.

If Shopify merchants are the first paying audience, the order of work changes: sections 6 (Ads & Guard) and 7 (account ownership) become the whole launch, and most of sections 4 and 5 drop to P2. The priorities below assume the built-in store ships as a real selling channel; adjust if it stays a sandbox.

---

## 2. Launch blockers (P0 summary)

| ID | Blocker | Section |
|---|---|---|
| D1 | Discover shows a cost that is 3× lower than the real cost after import | 3 |
| C1–C3 | Variants import with duplicate names, accessory SKUs at full price, and zero stock that still publishes | 4 |
| C4 | Publish fails silently when ship cost is 0 | 4 |
| S7–S8 | Storefront names Seto as the seller and exposes the operator's login email | 5 |
| K1–K2 | Stripe model: raw secret keys pasted in, platform sandbox as fallback | 7 |
| K5 | TikTok cannot be connected at all | 7 |
| A1–A3 | Margin Guard cannot run: Meta disconnected, setup steps point to fields that don't exist | 6 |
| P1 | Seto's own billing is in test mode, so subscriptions can't be collected | 8 |
| O1 | The order-to-delivery half of the product is unverified | 5 |

---

## 3. Discover (product identification)

Search for "portable blender" returned 22 live AliExpress listings in a few seconds. That part works.

| ID | Pri | Gap (observed) | Fix and acceptance check |
|---|---|---|---|
| D1 | P0 | Card showed **$7.30** cost; after import the product cost was **$23.16**. Suggested sell price and margin on the card were built on the wrong number. | Show the price of the main SKU, or a min–max range across real SKUs. Re-quote at import and show "price changed from X to Y" before saving. Check: card cost equals imported default-variant cost on 20 random listings. |
| D2 | P0 | Importing spends 1 of 5 trial credits with no preview and no confirmation. Combined with D1, a user burns credits on listings that turn out unsellable. | Add a free preview drawer (variants, real cost, stock, shipping, delivery days). Only charge the credit on "Add to catalog". |
| D3 | P1 | Every priced listing has the same score: **37**. Unpriced listings show "—". The score gives no signal. | Either compute a real score (margin, rating, order volume, delivery time, stock) and show what drives it on hover, or remove it. |
| D4 | P1 | 8 of 22 listings had no cost ("Verify cost on import"). | Enrich before display, or hide/flag unpriced listings behind a filter. |
| D5 | P1 | Shipping is a flat "~$2.49 (est.)" on every card. | Query real freight for the store's destination country per listing; show cost and delivery days. |
| D6 | P1 | Default 3× markup suggests $47–$138 for portable blenders. Those prices won't convert, and the "63% after fees" margin sets false expectations. | Suggest price from a market reference (competitor price range) with markup as a fallback. Cap or warn when suggestion is far above market. |
| D7 | P1 | "63% after fees" excludes ad spend, which is the dropshipper's biggest cost. | Label it "before ads" and show break-even cost per purchase and break-even ROAS on the card. |
| D8 | P1 | Sort offers "Most sold", "Top rated", "Fastest ship", but cards show no order count or delivery days, and rating only on some. | Show the fields the sort uses: orders, rating + review count, delivery days. |
| D9 | P1 | No filters: price range, ship-from country, delivery time, minimum rating, in-stock only. | Add them; persist the last used set. |
| D10 | P1 | Every card says "Confirm stock on import". Stock is unknown at search time. | Show stock or an "in stock / low / out" chip from the enrich call. |
| D11 | P1 | Import took about 10 seconds with no progress indicator. All Import buttons on the page went grey, then the page jumped to the product. | Per-card spinner with steps ("Fetching variants… Cleaning title…"), keep other cards usable, success toast with "Open product". |
| D12 | P2 | Card titles are cut mid-phrase ("…Multifunction Juice") and the full title repeats directly below. | Show the cleaned title once; put the supplier title in a tooltip. |
| D13 | P2 | "Visual match soon" and "CJ optional" badges advertise things a tenant cannot switch on. | Hide unfinished features, or show "coming soon" only on a roadmap page. |
| D14 | P2 | No demand or saturation signal (order trend, how many stores already run ads on it). | Recommended: add trend and ad-saturation indicators. This is the main reason people pay for discovery tools. |
| D15 | P2 | No way to compare or shortlist beyond "Save". | Recommended: compare view for 2–4 saved listings side by side. |

---

## 4. Catalog and product page (operator side)

Pricing maths is correct. At $34.99 with $23.16 cost and $2.49 shipping: card fee $1.31 (2.9% + $0.30), profit $8.03, margin 22.9%, markup 1.5108. All verified by hand.

| ID | Pri | Gap (observed) | Fix and acceptance check |
|---|---|---|---|
| C1 | P0 | Three variants all imported as **"1500mAh"**. The distinguishing attribute (colour) was dropped. | Build variant names from all option attributes ("White / 1500mAh"). Check: no two variants of one product share a name. |
| C2 | P0 | A **"1PC Cup Brush"** accessory (cost $2.56) imported as a variant and inherited the **$34.99** price when I set the selling price. | Detect outlier SKUs (cost far below the median) and exclude them by default. Add per-variant enable/disable and per-variant price. Changing the product price should scale variants, not flatten them. |
| C3 | P0 | All three real variants had **stock 0**. The product published with no warning and status "Published". The only buyable option was the brush. | Block or warn on publish when no enabled variant has stock. If stock 0 is an import error rather than true stock, fix the stock mapping. |
| C4 | P0 | With Ship $ = 0 and "Publish without a ship cost" unchecked, "Publish to your store" does **nothing**: no error, no toast, button stays enabled. Reproduced twice. | Show an inline error next to Ship $ and scroll to it, or disable the button with a reason. |
| C5 | P1 | Supplier freight "was not available", so shipping had to be typed by hand. Until then margin shows 63.3% "est., shipping unknown". | Fetch freight at import (same source as D5). Don't show a headline margin until shipping is known. |
| C6 | P1 | Catalog list shows **Stock: 1**, the sum across variants, which hides that the main variants are out. | Show sellable stock of enabled variants, with an "out of stock" badge. |
| C7 | P1 | Before any angles were generated, the panel said "Three angles ready to post". | Empty state: "No angles yet. Write ad angles." |
| C8 | P1 | Generated ad copy leaks internal phrasing ("It looks clean on camera") and repeats "small daily annoyance" in two of three angles. One angle hard-codes "$34.99", which goes stale when the price changes. | Tighten the prompt, de-duplicate phrases across angles, insert price as a live token or regenerate on price change. |
| C9 | P1 | "Post on Meta" and "Post on TikTok" copy only the script and open a blank ad-creation page. No product link, no UTM tags, no pixel reminder. | Copy script **and** a UTM-tagged product URL (source, campaign, product ID, angle ID). Without this, Guard cannot tie a sale to an ad. |
| C10 | P1 | Storefront copy is boilerplate: "ships with tracking. What you see is what we send." plus three generic bullets. No product benefits or specs. | Generate real product copy at import (benefits, specs, what's in the box). Untested: "Rewrite title & bullets" may already do this; if so, run it automatically. |
| C11 | P1 | Only one product image shown; no gallery or image management seen. | Import the full image set, let the operator reorder, remove and set a cover. Map images to variants. |
| C12 | P2 | "Mark ready" is still offered on a published product. Status filters are Draft / Ready / Local only / Published with no explanation. | One clear state machine with a tooltip per state; hide actions that don't apply. |
| C13 | P2 | No compare-at price, no quantity breaks or bundles. | Recommended: compare-at price and simple bundles ("buy 2, save 15%") to lift order value. |
| C14 | P2 | "Break-even ad cost / sale" is shown, but not break-even ROAS, which is what Ads Manager displays. | Show both. |
| C15 | P2 | Settings has a manual "Repair catalog" button that "caps fake ~99k stock figures and fixes unlabeled Option variants". Known import defects are being handed to the user. | Run these repairs automatically at import; keep the button only as a support tool. |

---

## 5. Storefront, checkout, orders and fulfilment

Storefront, bag and the hand-off to Stripe's hosted checkout all work. Sold-out variants are correctly blocked for shoppers.

### Storefront and trust

| ID | Pri | Gap (observed) | Fix and acceptance check |
|---|---|---|---|
| S1 | P1 | Store is named after the operator's personal name, with a generic "Ships with tracking. Pay by card." tagline. No logo, colours or brand settings seen. | Brand settings: store name, logo, accent colour, tagline, favicon. |
| S2 | P1 | Store lives at seto.store/s/your-name. No custom domain. | Custom domain with automatic certificate. Shoppers and ad reviewers trust a real domain more. |
| S3 | P1 | Product page has one image, a plain dropdown for options, no quantity selector, no reviews, a "FOR SALE" eyebrow label. Choosing a variant does not change the image. | Gallery, variant swatches with image swap, quantity, reviews block, delivery estimate by date. |
| S4 | P0 | Footer on every public page says **"Card checkout is in test mode"** while the dashboard says **"Store: Live"**. | Don't let a store show as live while checkout is in test mode. Gate the public store, or show a private preview link only. |
| S5 | P1 | Bag says "Shipping and tax are collected on the card page when they apply". The checkout showed only $34.99: no shipping line, no tax line. | Shipping-rate settings (free, flat, per product). Decide on tax handling and say so clearly. |
| S6 | P1 | Shipping country on checkout appeared fixed to United States. | Country list setting per store; block suppliers that don't ship to the chosen countries. |
| S7 | P0 | Contact page shows **"SetoStore, United States"** as the address and the operator's **Google login email** as the contact. That presents Seto as the seller and leaks a private email. | Require business name, support email and address before first publish. Never fall back to login email or to Seto's name. |
| S8 | P0 | Shipping, Refunds, Privacy and Terms are three lines each. Privacy has no mention of cookies or ad pixels. Terms has no seller identity, governing law or dispute terms. No cookie notice. | Full policy templates the operator reviews and accepts, filled with their business details. Add a cookie/pixel consent notice. Have a lawyer review the templates. |
| S9 | P1 | Refund page promises 30 days and "wrong or damaged items do not need to be sent back". Shipping page promises "we ship within 1 business day". No way to edit these was seen. | Make each promise an operator setting with a sensible default. |
| S10 | P1 | Only a Meta Pixel ID field exists. No TikTok pixel field, no server-side event option. | Meta Pixel + Conversions API and TikTok Pixel + Events API, with a test-event checker. Accurate purchase events are what Guard depends on. |
| S11 | P2 | Not checked: social share previews, page speed, mobile layout. | Verify on a phone; most ad traffic is mobile. |

### Checkout, orders, fulfilment

| ID | Pri | Gap | Fix and acceptance check |
|---|---|---|---|
| O1 | P0 | **Untested:** paid order appearing in Orders, net profit per order, fulfilment queue, tracking, refund. | Run one sandbox order end to end and confirm each screen updates. |
| O2 | P1 | **Observed:** Command feed shows "buyer@example.com paid 16.44" while Orders says "No orders yet" and revenue is $0.00. | Feed, Orders and metrics must read from the same records. Clearing the workspace should clear the feed. |
| O3 | P1 | **Observed:** Stripe checkout shows the merchant as "self sandbox". | Checkout must show the dropshipper's own business name once their account is connected. |
| O4 | P1 | **Observed:** Fulfilment is manual: copy the address, place the order on AliExpress, paste the supplier order ID, paste tracking later. CSV export exists. | One-click supplier ordering through the AliExpress dropshipping order API, with automatic tracking sync. This is table stakes among fulfilment tools. |
| O5 | P1 | **Observed:** Customer replies in Daily ops are copy-and-paste templates. Nothing sends them. | Automatic order-confirmed, shipped and delayed emails from the store's own address, plus a branded tracking page. Cuts "where is my order" messages and disputes. |
| O6 | P1 | **Observed:** Card fee is hard-coded at 2.9% + $0.30. | Read the real fee from each Stripe charge. Include refunds and dispute fees in net profit. |
| O7 | P2 | **Recommended:** abandoned-checkout recovery emails. | Stripe exposes expired checkout sessions; send one reminder. |
| O8 | P2 | **Recommended:** dispute handling. Long delivery windows cause chargebacks. | Dispute alerts with tracking evidence pre-filled. |

---

## 6. Ads & Guard (the product people would pay for)

Margin Guard reported "not protecting spend" and "Checked 0 ads". Nothing here could be verified as working.

| ID | Pri | Gap (observed) | Fix and acceptance check |
|---|---|---|---|
| A1 | P0 | Meta shows "Account Disconnected — Token Expired", printed twice. Dashboard says "Ad Tracking: Expired". | Long-lived tokens with automatic refresh. Email and in-app alert **before** expiry. One error message, one "Reconnect" button. |
| A2 | P0 | Setup steps say "Add your Meta ad account id in Settings" and "Add the Meta app id and secret". Settings has no such fields, and a dropshipper does not own a Meta app. | After sign-in, show a picker of the user's ad accounts. App ID and secret are Seto's and must never be asked of a tenant. |
| A3 | P0 | Public sign-in with ads permissions needs Meta's app review to be approved. "Extend pasted token" is offered with no visible field to paste into. | Complete Meta app review for the ads read and manage permissions. Remove the pasted-token path from the tenant UI. |
| A4 | P0 | Guard is described as "Dual-signal (Meta + Shopify)". Orders from the built-in Seto store are not mentioned as a signal, and TikTok is absent. | Guard must read sales from whichever store the user sells on, and spend from every connected ad platform. |
| A5 | P0 | No attribution path seen: ad links carry no UTM tags (see C9), so a sale cannot be matched to an ad set. | UTM builder + pixel/server events + order-level source stored on every order. Show "attributed / unattributed" share. |
| A6 | P1 | Checks run hourly. An hour of spend on a failing ad set can exceed a small tester's daily budget. | Check every 15 minutes, or faster for ad sets in their first day. |
| A7 | P1 | Mode is "alert only", but where alerts go is not shown. | Email, mobile push and optional SMS or chat alerts, with a one-tap "pause now" link. |
| A8 | P1 | Copy says "Quiet hours are off in Settings"; Settings calls it "Dayparting engine". | One name everywhere. |
| A9 | P1 | No per-product or per-campaign thresholds seen; one global set (spend floor 5, click rate 1.5%, cost per click 1.8, intent floor 15). | Per-campaign overrides, with defaults derived from each product's break-even numbers. |
| A10 | P1 | "Preview pause" is described but there was nothing to preview. | Demo mode with sample ad sets so a trial user sees Guard working before connecting anything. |
| A11 | P1 | No record of what Guard has done. | Audit log: every check, alert, pause and resume, with the numbers behind the decision and an undo. |
| A12 | P2 | Recommended: scale-up rules, not only kill rules. | "Raise budget 20% when net profit per day exceeds X for 2 days." |

---

## 7. Account ownership: the dropshipper owns Stripe, Meta and TikTok

Your stated rule is that Seto only facilitates. Today that holds for ads posting (Seto opens the user's own Ads Manager) and breaks elsewhere.

| ID | Pri | Gap (observed) | Fix and acceptance check |
|---|---|---|---|
| K1 | P0 | Stripe is connected by pasting **pk_live and sk_live keys** into Settings. Seto would store every merchant's full-access secret key. | Use Stripe Connect with the merchant's own standard account, joined by a sign-in redirect. If keys must be used, accept only restricted keys with the minimum permissions. Not legal advice: confirm against Stripe's current platform terms. |
| K2 | P0 | With no keys set, shoppers pay "the platform sandbox". I could not see what happens in live mode with no merchant account. | With no connected merchant account, checkout must be **disabled**, never routed to a Seto account. Otherwise Seto becomes the seller of record. |
| K3 | P0 | No webhook secret field per merchant. It is unclear how Seto learns about payments, refunds and disputes on the merchant's account. | Connect delivers account-level events to one Seto endpoint. Verify paid, refunded, disputed and expired-checkout events all land. |
| K4 | P1 | Stripe key fields have no "test connection" result or account name shown back. | After connecting, show the Stripe business name, country, and whether charges and payouts are enabled. |
| K5 | P0 | **TikTok card has no button or field.** Status "Needs you" with nothing to do. | TikTok sign-in for the user's own ad account through TikTok's marketing API (needs TikTok developer app approval), with read spend and pause permissions. |
| K6 | P1 | Meta: see A1–A3. | — |
| K7 | P1 | Header shows a green "CONNECTED" badge while Meta is expired, TikTok is absent and Stripe is in sandbox. Sidebar says "2 live APIs · Checkout test". | Replace with a single setup-status chip: "3 of 5 connected", linking to a checklist. |
| K8 | P1 | No guided setup. A new user gets a banner about Stripe keys and nothing else. | First-run checklist: business details → Stripe → Meta → TikTok → pixel → first product → first ad link. Show progress on Command until done. |
| K9 | P1 | No "disconnect" or "what Seto can do with this account" wording seen. | For each connection, list the permissions held in plain words and offer one-click disconnect. This is what makes "we only facilitate" believable. |
| K10 | P2 | Sign-in is Google only. | Add email sign-in; add team members with roles for agencies and virtual assistants. |

---

## 8. Platform, billing and trial

| ID | Pri | Gap (observed) | Fix and acceptance check |
|---|---|---|---|
| P1 | P0 | Settings says "Stripe is in test mode — upgrades will not take real cards". | Switch Seto's own billing to live; test upgrade, downgrade, cancel, failed payment and refund. |
| P2 | P0 | The Plan panel shows tenants internal configuration: "Platform secret: Test · Starter price: Set · Scaler price: Set · Webhook: Set". | Remove from the tenant UI; move to an admin-only page. |
| P3 | P1 | Tenant-facing copy talks about the "Host" ("Host can add a CJ key", "Host can add a visual-search key"). | Hide integrations a tenant cannot enable. |
| P4 | P1 | Plans sell "Lens lookups" (50 or 200 a month). Lens is never explained, and visual match is marked "soon" and not connected. | Don't sell a feature that isn't live. Explain each plan line in one sentence. |
| P5 | P1 | /pricing returns 404. Pricing is only in a pop-up after sign-in. | Public pricing page with plan comparison and FAQs. |
| P6 | P1 | Trial is limited by imports (5), which punishes exploring. Guard, the paid value, is limited to 1 campaign and can't be reached without Meta. | Trial on value: unlimited browsing and previews, 14 days of Guard on one ad account. |
| P7 | P2 | Upgrade pop-up is clipped at the top of the window; the heading is cut off. | Make it scroll within the viewport. |
| P8 | P2 | Header label is truncated to "Operator d…". | Shorten or drop. |
| P9 | P2 | No in-app view of what the current plan allows versus what's used beyond one line of text. | Usage meters with reset dates. |
| P10 | P2 | Recommended: status page, changelog and a support contact inside the app. | Paying users need a place to check when something breaks. |

---

## 9. What would make dropshippers pay, and keep paying

Fixing the gaps above makes Seto usable. These are what make it worth $19–$39 a month. All recommended.

### Prove the saving

1. **"Guard saved you $X" counter** on Command, per month and lifetime: the spend stopped on ad sets that were losing money. If the number is larger than the subscription, the renewal sells itself.
2. **True net profit per ad set, per product, per day**, after product cost, shipping, card fees, refunds and ad spend. Most dropshippers track this in a spreadsheet.
3. **Weekly email**: profit, best and worst ad set, money saved, what to test next.
4. **Guarantee**: if Guard saves less than the subscription in a month, that month is free. Low risk for you, strong message for them.

### Remove daily work

5. **One-click supplier ordering and automatic tracking** (O4).
6. **Automatic customer emails and a tracking page** (O5).
7. **Supplier watch**: when stock runs low or cost rises, alert and optionally pause the ads for that product. The Suppliers page already flags low stock; connect it to Guard.
8. **Mobile alerts with one-tap actions**. People run ads from their phones.

### Help them find winners honestly

9. **Real landed cost at search time** (D1, D5): cost, shipping and delivery days to their market.
10. **Demand and saturation signals** (D14).
11. **A realistic price suggestion** (D6) with break-even ROAS, so a beginner knows on day one what an ad must achieve.
12. **Launch kit per product**: tagged links, three ad angles, pixel check, and the 3-video organic test tracker already hinted at on Command.

### Earn trust

13. **They own every account**, shown plainly (K9). This is your differentiator against tools that sit in the money flow.
14. **Store credibility**: custom domain, branding, complete policies (S1, S2, S8).
15. **Audit log and undo for every automatic action** (A11). Nobody hands a pause button to software they can't inspect.

### Why this is win-win

Seto earns only when the dropshipper's ads are being watched, and the dropshipper pays only while the saving shows on screen. Tie plan limits to ad accounts and ad sets watched, not to imports.

---

## 10. Suggested order of work

**Phase 0: unblock launch**
- D1, D2, C1–C4 (correct cost, variants, stock, publish feedback)
- K1–K3, K5 (Stripe Connect, no platform fallback, TikTok connection)
- A1–A5 (Meta connection, attribution)
- S4, S7, S8 (test-mode leak, seller identity, policies)
- P1, P2 (live billing, hide internals)
- O1 (one full sandbox order, verified)

**Phase 1: complete the loop**
- O3–O6 (merchant name, auto-ordering, customer emails, real fees)
- S1–S3, S5, S6, S9, S10 (brand, domain, product page, shipping, pixels)
- A6–A11 (faster checks, alerts, thresholds, demo mode, audit log)
- K4, K7–K9 (connection status, setup checklist, permissions)
- D3–D11, C5–C11, P3–P6

**Phase 2: reasons to pay and stay**
- Section 9 items 1–4, 7, 10
- D12–D15, C12–C15, O7, O8, A12, K10, P7–P10

---

## 11. State left in the test account

- One published product: "Portable Mini Juicer Bottle 450ml" at $34.99, ship cost $2.49.
- Three ad angles generated for it.
- Trial imports used: 1 of 5.
- No payment was made and no account was connected or changed.
