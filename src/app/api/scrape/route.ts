import { NextRequest, NextResponse } from "next/server";
import { canonicalAliExpressUrl, isAliExpressItemUrl } from "@/lib/aliexpress-url";
import { isCjProductUrl } from "@/lib/integrations/cj";
import { scrapeSupplierUrl, type ParsedSupplierPayload } from "@/lib/scraper";
import { partitionVariants, uniquifyVariantNames } from "@/lib/variant-pricing";
import { money } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Free listing preview — does NOT spend an import credit.
 * Credits are charged only when the operator confirms Add to catalog.
 */
export async function POST(req: NextRequest) {
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
  if (!isAliExpressItemUrl(url) && !isCjProductUrl(url)) {
    return NextResponse.json(
      { error: "Paste a valid AliExpress or CJ product URL." },
      { status: 400 },
    );
  }

  try {
    const supplierUrl = isAliExpressItemUrl(url) ? canonicalAliExpressUrl(url) : url;
    const parsed = await scrapeSupplierUrl(url);
    return NextResponse.json({ ok: true, data: toPreview(parsed, supplierUrl) });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not scrape that listing." },
      { status: 422 },
    );
  }
}

function toPreview(parsed: ParsedSupplierPayload, supplierUrl: string) {
  const raw = parsed.variants.map((v) => ({
    skuId: v.skuId,
    name: v.attributes,
    attributes: v.attributes,
    cost: v.cost,
    stock: v.stock,
    imageUrl: v.imageUrl,
  }));
  const { primary, accessories } = partitionVariants(raw);
  const names = uniquifyVariantNames(primary.map((v) => v.name || v.attributes || "Option"));
  const variants = primary.map((v, i) => ({
    skuId: v.skuId,
    name: names[i]!,
    cost: v.cost,
    stock: v.stock,
    image: v.imageUrl,
  }));
  const costs = variants.map((v) => v.cost).filter((c) => c > 0);
  const minCost = costs.length ? Math.min(...costs) : parsed.baseCost;
  const maxCost = costs.length ? Math.max(...costs) : parsed.baseCost;
  return {
    title: parsed.title,
    supplierUrl,
    source: parsed.source,
    images: parsed.galleryImages,
    shippingCost: parsed.shippingCost,
    shippingDays: parsed.shippingDays,
    shippingUnknown: Boolean(parsed.shippingUnknown),
    baseCost: minCost,
    costLabel:
      costs.length > 1 && maxCost - minCost > 0.05
        ? `${money(minCost)}–${money(maxCost)}`
        : money(minCost),
    variants,
    accessoriesExcluded: accessories.length,
    stockTotal: variants.reduce((s, v) => s + Math.max(0, v.stock), 0),
  };
}
