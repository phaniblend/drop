import { extractAliExpressListing } from "./aliexpress-scrape/extract";
import type { ScrapedListing } from "./aliexpress-scrape/types";
import { normalizeVariantStocks } from "./supplier-stock";

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
  importPath?: "catalog" | "page";
};

export function listingToParsed(listing: ScrapedListing): ParsedSupplierPayload {
  const sale = listing.price.sale || listing.price.base;
  // extract.ts already humanizes names with the property lookup — keep them as-is.
  const variants: SupplierVariant[] = normalizeVariantStocks(
    listing.variants.length > 0
      ? listing.variants.map((v) => ({
          skuId: v.skuId,
          attributes: v.name || "Default",
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
        ],
  );

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
  const { isAliExpressItemUrl } = await import("./aliexpress-url");
  const { isCjProductUrl } = await import("./integrations/cj");

  if (isCjProductUrl(url)) {
    throw new Error(
      "CJ URL import needs a product detail API next — use Discover search → Import on a CJ card for now.",
    );
  }

  if (env.aliexpressAppKey && env.aliexpressAppSecret && /aliexpress\./i.test(url)) {
    try {
      const { fetchAliExpressProduct } = await import("./integrations/aliexpress");
      return { ...(await fetchAliExpressProduct(url)), importPath: "catalog" };
    } catch {
      // Official catalog failed — read the public listing page instead.
    }
  }

  if (isAliExpressItemUrl(url)) {
    const { scrapeAliExpressListing } = await import("./aliexpress-scrape");
    return { ...listingToParsed(await scrapeAliExpressListing(url)), importPath: "page" };
  }

  throw new Error("Paste a full AliExpress item URL (aliexpress.com/item/...).");
}
