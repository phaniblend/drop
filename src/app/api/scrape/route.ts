import { NextRequest, NextResponse } from "next/server";
import { assertProductQuota, isBillingError } from "@/lib/billing";
import { canonicalAliExpressUrl, isAliExpressItemUrl } from "@/lib/aliexpress-url";
import { scrapeSupplierUrl, type ParsedSupplierPayload } from "@/lib/scraper";
import type { ScrapedListing } from "@/lib/aliexpress-scrape/types";

export const runtime = "nodejs";
export const maxDuration = 60;

function toListing(parsed: ParsedSupplierPayload, supplierUrl: string): ScrapedListing {
  const sale = parsed.baseCost;
  return {
    title: parsed.title,
    price: { base: sale, sale },
    images: parsed.galleryImages,
    variants: parsed.variants.map((v) => ({
      skuId: v.skuId,
      name: v.attributes,
      image: v.imageUrl,
      inventory: v.stock,
      price: v.cost,
    })),
    supplierUrl,
  };
}

export async function POST(req: NextRequest) {
  try {
    await assertProductQuota();
  } catch (error) {
    if (isBillingError(error)) {
      return NextResponse.json(error.paywall, {
        status: error.paywall.code === "SUBSCRIPTION_PAST_DUE" ? 402 : 403,
      });
    }
    throw error;
  }

  let body: { url?: string };
  try {
    body = (await req.json()) as { url?: string };
  } catch {
    return NextResponse.json({ error: "JSON body required: { url }" }, { status: 400 });
  }

  const url = body.url?.trim() ?? "";
  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }
  if (!isAliExpressItemUrl(url)) {
    return NextResponse.json(
      { error: "Paste a valid AliExpress item link, like https://www.aliexpress.com/item/123.html" },
      { status: 400 },
    );
  }

  try {
    const supplierUrl = canonicalAliExpressUrl(url);
    const parsed = await scrapeSupplierUrl(url);
    return NextResponse.json({ ok: true, data: toListing(parsed, supplierUrl) });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not scrape that listing." },
      { status: 422 },
    );
  }
}
