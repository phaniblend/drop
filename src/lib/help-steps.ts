export type HelpStep = {
  id: number;
  label: string;
  desc: string;
  href?: string;
};

export const HELP_STEPS: HelpStep[] = [
  { id: 1, label: "Check Profit/ROAS", desc: "Look at the Command summary to check Net Profit (today) and ad spend vs revenue.", href: "/" },
  { id: 2, label: "Safety Alerts", desc: "Check the triage alerts to see if any bleeding ad sets were auto-paused overnight.", href: "/" },
  { id: 3, label: "Fulfillment Tab", desc: "Click Fulfill in the left menu.", href: "/fulfillment" },
  { id: 4, label: "Review Orders", desc: "Review the list of new unfulfilled orders waiting for supplier purchase.", href: "/fulfillment" },
  { id: 5, label: "Supplier Checkout", desc: "Use Copy address and Open supplier on each order, or download the batch CSV.", href: "/fulfillment" },
  { id: 6, label: "Verify Addresses", desc: "When the supplier checkout opens, verify that customer shipping addresses match the cards.", href: "/fulfillment" },
  { id: 7, label: "Pay Supplier", desc: "Pay on the supplier portal (AliExpress / CJ) to authorize the batch." },
  { id: 8, label: "Return to Tool", desc: "Close the supplier tab and return to this desk.", href: "/fulfillment" },
  { id: 9, label: "Mark Paid", desc: "Enter the supplier order id and click Mark placed to update statuses.", href: "/fulfillment" },
  { id: 10, label: "Discovery Tab", desc: "Click Discover in the left menu.", href: "/discover" },
  { id: 11, label: "Search Bar", desc: "Click inside Search the feed.", href: "/discover" },
  { id: 12, label: "Enter Query", desc: "Type your product query (for example: ultrasonic teeth plaque remover).", href: "/discover" },
  { id: 13, label: "Select Market", desc: "Pick a niche chip (home, car, pet, beauty, health, outdoors).", href: "/discover" },
  { id: 14, label: "Find Products", desc: "The scored cards update as you search. Scroll the grid.", href: "/discover" },
  { id: 15, label: "Browse Cards", desc: "Scroll through the generated list of product cards.", href: "/discover" },
  { id: 16, label: "Review Margins", desc: "Check landed cost, retail, and margin % after fees on each card.", href: "/discover" },
  { id: 17, label: "Import & Enrich", desc: "Pick a winner and click Import & clean.", href: "/discover" },
  { id: 18, label: "Wait for Scrape", desc: "Wait a few seconds while the product is imported and copy is cleaned.", href: "/discover" },
  { id: 19, label: "Draft Listings", desc: "Click Catalog in the left menu. New imports land as drafts.", href: "/catalog" },
  { id: 20, label: "Open Editor", desc: "Click the newly imported product title to open the editor.", href: "/catalog" },
  { id: 21, label: "Clean Images", desc: "Look at the gallery photo. Confirm it looks storefront-ready.", href: "/catalog" },
  { id: 22, label: "Review Copy", desc: "Review the cleaned product title and benefit bullets.", href: "/catalog" },
  { id: 23, label: "Tweak Copy", desc: "Click Rewrite title & bullets, or edit pricing fields if you want custom tweaks.", href: "/catalog" },
  { id: 24, label: "Pricing Matrix", desc: "Scroll to Variants — that is your SKU and price map.", href: "/catalog" },
  { id: 25, label: "Check Markups", desc: "Check retail prices so markup is at least 3× base cost.", href: "/catalog" },
  { id: 26, label: "Publish Draft", desc: "Click Publish to Shopify. Demo mode marks it published locally if Shopify is offline.", href: "/catalog" },
  { id: 27, label: "Confirm ID", desc: "Confirm the Shopify product id (or the local demo id) on that screen.", href: "/catalog" },
  { id: 28, label: "Ad Hooks", desc: "Use the cleaned title as your hook. Film 2–3 short clips from the product angle." },
  { id: 29, label: "Copy Hooks", desc: "Copy a short hook to your clipboard — one sentence, problem then payoff." },
  { id: 30, label: "Copy UTM URL", desc: "Copy your storefront product URL and add UTM tags before you spend." },
  { id: 31, label: "Film Creatives", desc: "Step away and film or edit 2 to 3 short clips using a sample and those hooks." },
  { id: 32, label: "Open Ad Manager", desc: "Open TikTok Ads Manager or Meta Ads Manager in a new browser tab." },
  { id: 33, label: "Launch Campaign", desc: "Create a campaign, upload the video, paste the tracking URL, set a daily budget (e.g. $20/day)." },
  { id: 34, label: "Copy Ad Set ID", desc: "Copy the new Ad Set ID from Meta or TikTok." },
  { id: 35, label: "Margin Guard", desc: "Come back here and click Ads & Guard.", href: "/ads" },
  { id: 36, label: "Register Ad Set", desc: "Use Circuit check on the matching campaign card (or pause locally in demo).", href: "/ads" },
  { id: 37, label: "Link Product", desc: "Confirm the card is tied to the right product name.", href: "/ads" },
  { id: 38, label: "Configure Rules", desc: "Kill cap and min ROAS live on each card (defaults $50 spend and 1.20 ROAS).", href: "/ads" },
  { id: 39, label: "Activate Guard", desc: "Click Circuit check (or Run all circuit checks). Cron hits /api/cron/margin-guard when hosted.", href: "/ads" },
  { id: 40, label: "Telemetry Live", desc: "Return to Command and leave the desk open so today's P&L and alerts stay in view.", href: "/" },
];
