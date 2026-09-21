import * as cheerio from "cheerio";
import type { ScrapedListing, ScrapedVariant } from "./types";
import { collectVariantLookup, labeledVariantName } from "../variant-label";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function num(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const n = parseFloat(String(value ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

function absUrl(src: string) {
  const trimmed = src.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed.replace(/_\d+x\d+\.jpg$/i, "");
  }
  return "";
}

function uniqueUrls(urls: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    const url = absUrl(raw);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
    if (out.length >= 16) break;
  }
  return out;
}

function extractObjectLiteral(source: string, fromIndex: number): string | null {
  const start = source.indexOf("{", fromIndex);
  if (start < 0) return null;
  let depth = 0;
  let inString: '"' | "'" | "`" | null = null;
  let escaped = false;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === inString) inString = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inString = ch;
      continue;
    }
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return null;
}

function parseJsonLoose(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    try {
      return JSON.parse(text.replace(/,\s*([}\]])/g, "$1"));
    } catch {
      return null;
    }
  }
}

function assignedObject(html: string, marker: string): unknown | null {
  const idx = html.indexOf(marker);
  if (idx < 0) return null;
  const literal = extractObjectLiteral(html, idx);
  if (!literal) return null;
  return parseJsonLoose(literal);
}

function jsonLdProducts(html: string): Array<Record<string, unknown>> {
  const $ = cheerio.load(html);
  const out: Array<Record<string, unknown>> = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const parsed = parseJsonLoose($(el).text());
    const items = Array.isArray(parsed) ? parsed : [parsed];
    for (const item of items) {
      const rec = asRecord(item);
      if (!rec) continue;
      const graph = rec["@graph"];
      if (Array.isArray(graph)) {
        for (const node of graph) {
          const n = asRecord(node);
          if (n && String(n["@type"] ?? "").toLowerCase().includes("product")) out.push(n);
        }
      }
      if (String(rec["@type"] ?? "").toLowerCase().includes("product")) out.push(rec);
    }
  });
  return out;
}

function listingFromJsonLd(nodes: Array<Record<string, unknown>>, supplierUrl: string): ScrapedListing | null {
  const product = nodes[0];
  if (!product) return null;
  const name = String(product.name ?? "").trim();
  const images = uniqueUrls(
    Array.isArray(product.image) ? product.image.map(String) : product.image ? [String(product.image)] : [],
  );
  const offers = asRecord(product.offers) ?? asRecord(Array.isArray(product.offers) ? product.offers[0] : null);
  const sale = num(offers?.price ?? offers?.lowPrice);
  if (!name && !images.length && !sale) return null;
  return {
    title: name || "AliExpress listing",
    price: { base: sale, sale },
    images,
    variants: sale
      ? [{ skuId: "DEFAULT", name: "Default", inventory: 0, price: sale, image: images[0] }]
      : [],
    supplierUrl,
  };
}

function skuList(root: Record<string, unknown>): ScrapedVariant[] {
  const sku =
    asRecord(root.skuComponent) ??
    asRecord(root.skuModule) ??
    asRecord(asRecord(root.data)?.skuComponent);
  const lookup = collectVariantLookup(sku ?? root);
  const list = (sku?.skuPriceList ?? sku?.skuPriceListMap ?? []) as unknown;
  const rows = Array.isArray(list) ? list : [];
  return rows
    .map((row, index) => {
      const rec = asRecord(row);
      if (!rec) return null;
      const val = asRecord(rec.skuVal) ?? rec;
      const price = num(val.actSkuCalPrice ?? val.skuCalPrice ?? rec.skuAmount ?? rec.price);
      const rawName = String(
        rec.skuAttrStr ?? rec.skuAttr ?? rec.skuAttrName ?? rec.name ?? "Default",
      );
      const variant: ScrapedVariant = {
        skuId: String(rec.skuId ?? rec.sku_id ?? "default"),
        name: labeledVariantName(rawName, index, lookup),
        inventory: Math.round(num(val.availQuantity ?? rec.skuAvailQuantity ?? rec.inventory, 0)),
        price,
        image: absUrl(String(rec.skuPropertyImagePath ?? rec.skuImg ?? "")) || undefined,
      };
      return variant;
    })
    .filter((v): v is ScrapedVariant => Boolean(v));
}

function listingFromRunParams(raw: unknown, supplierUrl: string): ScrapedListing | null {
  const top = asRecord(raw);
  if (!top) return null;
  const root =
    asRecord(top.data) ??
    asRecord(asRecord(top.data)?.data) ??
    top;

  const titleModule = asRecord(root.titleModule) ?? asRecord(root.productInfoComponent);
  const priceModule = asRecord(root.priceModule) ?? asRecord(root.priceComponent);
  const imageModule = asRecord(root.imageModule) ?? asRecord(root.imageComponent);

  const orig = asRecord(asRecord(priceModule?.origPrice)?.minAmount) ?? asRecord(priceModule?.minAmount);
  const saleBlock =
    asRecord(asRecord(priceModule?.maxAmountFormated)) ??
    asRecord(priceModule?.formatedActivityPrice) ??
    asRecord(asRecord(priceModule?.price)?.minAmount);
  const minAmount = asRecord(priceModule?.minAmount);

  const variants = skuList(root);
  const sale = num(
    variants[0]?.price ?? orig?.value ?? priceModule?.minActivityAmount ?? priceModule?.actSkuCalPrice ?? saleBlock?.value,
  );
  const base = num(orig?.value ?? minAmount?.value ?? sale, sale);

  const images = uniqueUrls([
    ...((imageModule?.imagePathList as unknown[]) ?? []).map(String),
    ...((imageModule?.imageList as unknown[]) ?? []).map((img) =>
      String(asRecord(img)?.imageUrl ?? asRecord(img)?.imgUrl ?? img),
    ),
    ...variants.map((v) => v.image ?? ""),
  ]);

  const title = String(
    titleModule?.subject ?? titleModule?.name ?? root.subject ?? root.title ?? "",
  ).trim();

  if (!title && !images.length && !sale) return null;

  return {
    title: title || "AliExpress listing",
    price: { base: base || sale, sale: sale || base },
    images,
    variants:
      variants.length > 0
        ? variants
        : [{ skuId: "DEFAULT", name: "Default", inventory: 0, price: sale || base, image: images[0] }],
    supplierUrl,
  };
}

export function isChallengeHtml(html: string) {
  const compact = html.replace(/\s+/g, " ").slice(0, 20_000);
  const blocked = /captcha|punish|slider|access denied|robot check|cf-challenge|punishpage/i.test(
    compact,
  );
  const hasProduct =
    /runParams|_init_data_|skuPriceList|og:title|application\/ld\+json/i.test(html);
  if (html.length < 4000 && blocked) return true;
  return blocked && !hasProduct;
}

export function extractAliExpressListing(html: string, supplierUrl: string): ScrapedListing {
  const fromInit =
    listingFromRunParams(assignedObject(html, "window._init_data_"), supplierUrl) ??
    listingFromRunParams(assignedObject(html, "_init_data_"), supplierUrl);
  if (fromInit?.title) return fromInit;

  const fromRun =
    listingFromRunParams(assignedObject(html, "window.runParams"), supplierUrl) ??
    listingFromRunParams(assignedObject(html, "runParams"), supplierUrl);
  if (fromRun?.title) return fromRun;

  const csrf = html.match(/data:\s*(\{[\s\S]*?\})\s*,\s*csrfToken/);
  if (csrf?.[1]) {
    const fromCsrf = listingFromRunParams(parseJsonLoose(csrf[1]), supplierUrl);
    if (fromCsrf?.title) return fromCsrf;
  }

  const fromLd = listingFromJsonLd(jsonLdProducts(html), supplierUrl);
  if (fromLd) return fromLd;

  const $ = cheerio.load(html);
  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim();
  const ogImage = $('meta[property="og:image"]').attr("content");
  const ogPrice = $('meta[property="og:price:amount"]').attr("content") ?? $('meta[itemprop="price"]').attr("content");
  if (ogTitle) {
    const sale = num(ogPrice);
    const images = uniqueUrls(ogImage ? [ogImage] : []);
    return {
      title: ogTitle,
      price: { base: sale, sale },
      images,
      variants: [{ skuId: "DEFAULT", name: "Default", inventory: 0, price: sale, image: images[0] }],
      supplierUrl,
    };
  }

  throw new Error("Could not extract product data from that AliExpress page.");
}
