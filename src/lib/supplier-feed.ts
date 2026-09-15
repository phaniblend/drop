export type FeedProduct = {
  id: string;
  title: string;
  cleanTitle: string;
  url: string;
  source: "aliexpress" | "cj";
  supplierName: string;
  niche: string;
  cost: number;
  shipping: number;
  shippingDays: number;
  stock: number;
  demand: number;
  image: string;
  tags: string[];
  variants: Array<{ skuId: string; attributes: string; cost: number; stock: number }>;
};

export const SUPPLIER_FEED: FeedProduct[] = [
  {
    id: "feed_posture",
    title: "Smart Posture Corrector Brace Adjustable Back Support Invisible Under Clothes Wholesale",
    cleanTitle: "LineFix Posture Brace",
    url: "https://www.aliexpress.com/item/1005101.html",
    source: "aliexpress",
    supplierName: "Golden Drop Gadgets",
    niche: "health",
    cost: 4.6,
    shipping: 1.8,
    shippingDays: 12,
    stock: 540,
    demand: 0.82,
    image:
      "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=900&q=80",
    tags: ["health", "tiktok", "evergreen"],
    variants: [
      { skuId: "PF-S", attributes: "S/M Black", cost: 4.6, stock: 220 },
      { skuId: "PF-L", attributes: "L/XL Black", cost: 4.85, stock: 320 },
    ],
  },
  {
    id: "feed_lightbar",
    title: "USB Screen Light Bar Computer Monitor Lamp Eye Care Stepless Dimming",
    cleanTitle: "RimLight Monitor Bar",
    url: "https://www.aliexpress.com/item/1005102.html",
    source: "aliexpress",
    supplierName: "Lumen Home Factory",
    niche: "home",
    cost: 8.9,
    shipping: 2.4,
    shippingDays: 13,
    stock: 210,
    demand: 0.7,
    image:
      "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=900&q=80",
    tags: ["desk", "wfh", "lighting"],
    variants: [{ skuId: "RL-1", attributes: "Black", cost: 8.9, stock: 210 }],
  },
  {
    id: "feed_groom",
    title: "Dog Paw Cleaner Cup Soft Silicone Portable Pet Foot Washer Outdoor",
    cleanTitle: "PawRinse Cleaner Cup",
    url: "https://cjdropshipping.com/product/pawrinse",
    source: "cj",
    supplierName: "PetForge Wholesale",
    niche: "pet",
    cost: 3.45,
    shipping: 1.35,
    shippingDays: 7,
    stock: 880,
    demand: 0.76,
    image:
      "https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=900&q=80",
    tags: ["pet", "us-warehouse"],
    variants: [
      { skuId: "PR-S", attributes: "Small", cost: 3.45, stock: 400 },
      { skuId: "PR-M", attributes: "Medium", cost: 3.95, stock: 480 },
    ],
  },
  {
    id: "feed_trunk",
    title: "Car Trunk Organizer Foldable Multi Compartment Heavy Duty SUV Storage",
    cleanTitle: "BayFold Trunk Organizer",
    url: "https://www.aliexpress.com/item/1005104.html",
    source: "aliexpress",
    supplierName: "Golden Drop Gadgets",
    niche: "car",
    cost: 7.2,
    shipping: 3.1,
    shippingDays: 15,
    stock: 160,
    demand: 0.64,
    image:
      "https://images.unsplash.com/photo-1489824904134-891ab64532f1?auto=format&fit=crop&w=900&q=80",
    tags: ["car", "storage"],
    variants: [{ skuId: "BF-1", attributes: "Black", cost: 7.2, stock: 160 }],
  },
  {
    id: "feed_ice",
    title: "Facial Ice Roller Skin Care Beauty Massage Tool Frozen Face Lift",
    cleanTitle: "Glacier Face Roller",
    url: "https://www.aliexpress.com/item/1005105.html",
    source: "aliexpress",
    supplierName: "Lumen Home Factory",
    niche: "beauty",
    cost: 2.9,
    shipping: 1.4,
    shippingDays: 11,
    stock: 1200,
    demand: 0.88,
    image:
      "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=900&q=80",
    tags: ["beauty", "ugc", "impulse"],
    variants: [
      { skuId: "GF-P", attributes: "Pink", cost: 2.9, stock: 700 },
      { skuId: "GF-B", attributes: "Blue", cost: 2.9, stock: 500 },
    ],
  },
  {
    id: "feed_cable",
    title: "Magnetic Cable Organizer Clips Desktop Cord Holder 7 Slots Silicone",
    cleanTitle: "ClipRail Cable Tray",
    url: "https://www.aliexpress.com/item/1005106.html",
    source: "aliexpress",
    supplierName: "Golden Drop Gadgets",
    niche: "home",
    cost: 1.85,
    shipping: 1.1,
    shippingDays: 10,
    stock: 2000,
    demand: 0.6,
    image:
      "https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?auto=format&fit=crop&w=900&q=80",
    tags: ["desk", "cheap-test"],
    variants: [{ skuId: "CR-1", attributes: "Gray", cost: 1.85, stock: 2000 }],
  },
  {
    id: "feed_camp",
    title: "Portable Camping Lantern LED Rechargeable Waterproof Tent Light",
    cleanTitle: "TrailGlow Lantern",
    url: "https://www.aliexpress.com/item/1005107.html",
    source: "aliexpress",
    supplierName: "Golden Drop Gadgets",
    niche: "outdoors",
    cost: 6.1,
    shipping: 2.2,
    shippingDays: 14,
    stock: 95,
    demand: 0.58,
    image:
      "https://images.unsplash.com/photo-1504851149312-7a075b496cc7?auto=format&fit=crop&w=900&q=80",
    tags: ["outdoors", "seasonal"],
    variants: [{ skuId: "TG-1", attributes: "Olive", cost: 6.1, stock: 95 }],
  },
  {
    id: "feed_mat",
    title: "Non Slip Yoga Mat Towel Hot Yoga Super Absorbent Microfiber Print",
    cleanTitle: "GripTide Yoga Towel",
    url: "https://cjdropshipping.com/product/griptide",
    source: "cj",
    supplierName: "PetForge Wholesale",
    niche: "health",
    cost: 5.4,
    shipping: 2.0,
    shippingDays: 8,
    stock: 340,
    demand: 0.67,
    image:
      "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=900&q=80",
    tags: ["fitness", "us-warehouse"],
    variants: [{ skuId: "GT-1", attributes: "Print", cost: 5.4, stock: 340 }],
  },
];

export function searchFeed(query: string, niche?: string) {
  const q = query.trim().toLowerCase();
  return SUPPLIER_FEED.filter((p) => {
    const hay = `${p.title} ${p.cleanTitle} ${p.niche} ${p.tags.join(" ")}`.toLowerCase();
    const matchesQuery = !q || hay.includes(q);
    const matchesNiche = !niche || niche === "all" || p.niche === niche;
    return matchesQuery && matchesNiche;
  });
}

export function lookupFeedByUrl(url: string) {
  const hit = SUPPLIER_FEED.find((p) => url.includes(p.id.replace("feed_", "")) || p.url === url || url.includes(p.url.split("/").pop() ?? "___"));
  if (!hit) {
    const byItem = SUPPLIER_FEED.find((p) => url.includes(p.url.split("item/")[1] ?? "___"));
    if (!byItem) return null;
    return toPayload(byItem);
  }
  return toPayload(hit);
}

export function lookupFeedById(id: string) {
  const hit = SUPPLIER_FEED.find((p) => p.id === id);
  return hit ? toPayload(hit) : null;
}

export function getFeedProduct(id: string) {
  return SUPPLIER_FEED.find((p) => p.id === id) ?? null;
}

function toPayload(hit: FeedProduct) {
  return {
    title: hit.title,
    baseCost: hit.cost,
    shippingCost: hit.shipping,
    shippingDays: hit.shippingDays,
    source: hit.source,
    galleryImages: [hit.image],
    variants: hit.variants.map((v) => ({
      skuId: v.skuId,
      attributes: v.attributes,
      cost: v.cost,
      stock: v.stock,
      imageUrl: hit.image,
    })),
  };
}
