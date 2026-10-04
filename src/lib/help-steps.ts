export type HelpStep = {
  id: string;
  label: string;
  desc: string;
  href?: string;
};

export type HelpTour = {
  id: string;
  title: string;
  blurb: string;
  steps: HelpStep[];
};

export const HELP_TOURS: HelpTour[] = [
  {
    id: "source",
    title: "Source your first product",
    blurb: "5 steps — search the live feed and import a winner.",
    steps: [
      { id: "s1", label: "Open Discover", desc: "Use Discover in the header or left menu to search live supplier catalogs.", href: "/discover" },
      { id: "s2", label: "Search the feed", desc: "Type a product (for example: ultrasonic plaque remover) and pick a niche chip.", href: "/discover" },
      { id: "s3", label: "Read the margin", desc: "Check what you pay, the selling price, and profit after fees on each card.", href: "/discover" },
      { id: "s4", label: "Import & clean", desc: "Pick a winner and click Import & clean. Wait a few seconds for copy to land.", href: "/discover" },
      { id: "s5", label: "Open the draft", desc: "New imports land in Catalog as drafts. Click the title to edit.", href: "/catalog" },
    ],
  },
  {
    id: "publish",
    title: "Clean and publish",
    blurb: "4 steps — photos, price, and a live store link.",
    steps: [
      { id: "p1", label: "Review the listing", desc: "Confirm the photo looks store-ready and the title is shopper language.", href: "/catalog" },
      { id: "p2", label: "Rewrite if needed", desc: "Use Rewrite title & bullets, then set retail so markup is at least 3× cost.", href: "/catalog" },
      { id: "p3", label: "Publish", desc: "Click Publish to your store. The product goes live for shoppers.", href: "/catalog" },
      { id: "p4", label: "Confirm the link", desc: "Open the store link and make sure the product page loads.", href: "/store" },
    ],
  },
  {
    id: "orders",
    title: "Process orders",
    blurb: "4 steps — copy a clean address and buy from the supplier.",
    steps: [
      { id: "o1", label: "Open Fulfill", desc: "New paid orders wait in Fulfill until you buy them from AliExpress or CJ.", href: "/fulfillment" },
      { id: "o2", label: "Copy the address", desc: "Use Copy address — it pastes one normalized mailing label, not mixed street lines.", href: "/fulfillment" },
      { id: "o3", label: "Pay the supplier", desc: "Open the supplier tab, paste the address, and pay. Then come back here.", href: "/fulfillment" },
      { id: "o4", label: "Mark placed", desc: "Enter the supplier order id and click Mark placed so tracking can be pasted later.", href: "/fulfillment" },
    ],
  },
  {
    id: "ops",
    title: "Daily ops",
    blurb: "3 steps — aging shipments and customer replies.",
    steps: [
      { id: "d1", label: "Aging shipments", desc: "Daily ops lists orders that still need a reply or tracking update.", href: "/ops" },
      { id: "d2", label: "Saved replies", desc: "Select an aging order, then copy a filled “where is my order?” reply.", href: "/ops" },
      { id: "d3", label: "Refunds", desc: "Resolve open refund requests from the same screen so they do not pile up.", href: "/ops" },
    ],
  },
  {
    id: "guard",
    title: "Configure Margin Guard",
    blurb: "4 steps — pause ads that are losing money.",
    steps: [
      { id: "g1", label: "Open Ads & Guard", desc: "Connect Meta in Settings first, then open Ads & Guard.", href: "/ads" },
      { id: "g2", label: "Set the rules", desc: "Spend cap and min sales-per-ad-dollar live on each campaign card.", href: "/ads" },
      { id: "g3", label: "Check ads", desc: "Click Check ads. Hosted desks re-check on a timer — leave Command open.", href: "/ads" },
      { id: "g4", label: "Do today’s one job", desc: "Command shows one directive from Guard and your catalog. Do that, then stop.", href: "/" },
    ],
  },
];

export const HELP_STEPS: HelpStep[] = HELP_TOURS.flatMap((tour) => tour.steps);
