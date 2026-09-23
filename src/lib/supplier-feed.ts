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
  orders30d?: number;
  live?: boolean;
  image: string;
  tags: string[];
  variants: Array<{ skuId: string; attributes: string; cost: number; stock: number }>;
};

/** Demo catalog removed — Discover only shows live AliExpress / CJ results. */
export const SUPPLIER_FEED: FeedProduct[] = [];

export function searchFeed(_query: string, _niche = "all"): FeedProduct[] {
  return [];
}

export function lookupFeedByUrl(_url: string) {
  return null;
}

export function lookupFeedById(_id: string) {
  return null;
}

export function getFeedProduct(_id: string) {
  return null;
}
