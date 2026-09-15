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

export function parseHydrationData(scriptContent: string): ParsedSupplierPayload {
  const matched = scriptContent.match(/data:\s*(\{[\s\S]*?\})\s*,\s*csrfToken/);
  if (!matched?.[1]) {
    throw new Error("Could not isolate the supplier JSON payload from the page script.");
  }

  const payload = JSON.parse(matched[1]) as {
    productInfoComponent?: { subject?: string };
    priceComponent?: { origPrice?: { minAmount?: { value?: string } } };
    skuComponent?: {
      skuPriceList?: Array<{
        skuId?: string | number;
        skuAttr?: string;
        skuVal?: {
          actSkuCalPrice?: string;
          skuCalPrice?: string;
          availQuantity?: number;
        };
        skuPropertyImagePath?: string;
      }>;
    };
    imageComponent?: { imagePathList?: string[] };
  };

  const productInfo = payload.productInfoComponent ?? {};
  const priceInfo = payload.priceComponent ?? {};
  const skuInfo = payload.skuComponent ?? {};
  const imageInfo = payload.imageComponent ?? {};

  const variants: SupplierVariant[] = (skuInfo.skuPriceList ?? []).map((sku) => ({
    skuId: String(sku.skuId ?? "default"),
    attributes: sku.skuAttr || "Default",
    cost: parseFloat(sku.skuVal?.actSkuCalPrice || sku.skuVal?.skuCalPrice || "0.00"),
    stock: sku.skuVal?.availQuantity || 0,
    imageUrl: sku.skuPropertyImagePath,
  }));

  return {
    title: productInfo.subject || "Imported Wholesale Product",
    baseCost: parseFloat(priceInfo.origPrice?.minAmount?.value || String(variants[0]?.cost || 0)),
    shippingCost: 1.99,
    shippingDays: 14,
    source: "aliexpress",
    galleryImages: (imageInfo.imagePathList || []).map((img) => img.replace(/_\d+x\d+\.jpg$/, "")),
    variants,
  };
}

export async function scrapeSupplierUrl(targetUrl: string): Promise<ParsedSupplierPayload> {
  const { env } = await import("./env");
  const { lookupFeedByUrl } = await import("./supplier-feed");

  const fromFeed = lookupFeedByUrl(targetUrl);
  if (fromFeed) return fromFeed;

  if (env.aliexpressAppKey && env.aliexpressAppSecret) {
    const { fetchAliExpressProduct } = await import("./integrations/aliexpress");
    return fetchAliExpressProduct(targetUrl);
  }

  if (env.enableHeadlessScrape) {
    try {
      const { scrapeWithPlaywright } = await import("./integrations/playwright-scrape");
      return scrapeWithPlaywright(targetUrl);
    } catch (error) {
      throw new Error(
        `Headless scrape failed (${error instanceof Error ? error.message : "unknown"}). Install Playwright browsers or paste a product URL from Discover.`,
      );
    }
  }

  throw new Error(
    "No live supplier credentials yet. Use Discover (demo catalog), CSV import, or add an AliExpress app key. Headless scrape stays off until you set ENABLE_HEADLESS_SCRAPE=true.",
  );
}
