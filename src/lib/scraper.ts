import { extractAliExpressListing } from "./aliexpress-scrape/extract";
import type { ScrapedListing } from "./aliexpress-scrape/types";

export type SupplierVariant = {
  skuId: string;
  attributes: string;
  cost: number;
  stock: number;
  imageUrl?: string;
};

export type ParsedSupplierPayload = {
  title: string;
  baseCost: number;
  shippingCost: number;
  shippingDays: number;
  galleryImages: string[];
  source: "aliexpress" | "cj" | "manual";
  variants: SupplierVariant[];
};

export function listingToParsed(listing: ScrapedListing): ParsedSupplierPayload {
  const sale = listing.price.sale || listing.price.base;
  const variants: SupplierVariant[] =
    listing.variants.length > 0
      ? listing.variants.map((v) => ({
          skuId: v.skuId,
          attributes: v.name,
          cost: v.price ?? sale,
          stock: v.inventory,
          imageUrl: v.image,
        }))
      : [
          {
            skuId: "DEFAULT",
            attributes: "Default",
            cost: sale,
            stock: 0,
            imageUrl: listing.images[0],
          },
        ];

  return {
    title: listing.title,
    baseCost: variants[0]?.cost ?? sale,
    shippingCost: 0,
    shippingDays: 14,
    source: "aliexpress",
    galleryImages: listing.images,
    variants,
  };
}

export function parseHydrationData(scriptContent: string): ParsedSupplierPayload {
  return listingToParsed(
    extractAliExpressListing(scriptContent, "https://www.aliexpress.com/item/0.html"),
  );
}

function assertHttpUrl(targetUrl: string) {
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    throw new Error("Paste a full http(s) supplier URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Supplier URL must start with http or https.");
  }
  return parsed.toString();
}

export async function scrapeSupplierUrl(targetUrl: string): Promise<ParsedSupplierPayload> {
  const url = assertHttpUrl(targetUrl);
  const { env } = await import("./env");
  const { lookupFeedByUrl } = await import("./supplier-feed");
  const { isAliExpressItemUrl } = await import("./aliexpress-url");

  const fromFeed = lookupFeedByUrl(url);
  if (fromFeed) return fromFeed;

  if (env.aliexpressAppKey && env.aliexpressAppSecret && /aliexpress\.com/i.test(url)) {
    const { fetchAliExpressProduct } = await import("./integrations/aliexpress");
    return fetchAliExpressProduct(url);
  }

  if (isAliExpressItemUrl(url)) {
    const { scrapeAliExpressListing } = await import("./aliexpress-scrape");
    return listingToParsed(await scrapeAliExpressListing(url));
  }

  throw new Error("Paste a full AliExpress item URL (aliexpress.com/item/...).");
}
