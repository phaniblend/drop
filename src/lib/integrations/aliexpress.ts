import "server-only";

import { createHmac } from "node:crypto";
import { env } from "../env";
import type { FeedProduct } from "../supplier-feed";
import type { ParsedSupplierPayload } from "../scraper";
import { extractAliExpressProductId } from "../aliexpress-url";
import { humanizeVariantLabel } from "../variant-label";
import { fetchAliExpressHtml } from "../aliexpress-scrape/http";

type AliParams = Record<string, string>;

function extractProductId(url: string) {
  return extractAliExpressProductId(url) || url;
}

function sign(params: AliParams) {
  const signSource = Object.keys(params)
    .sort()
    .map((k) => `${k}${params[k]}`)
    .join("");
  return createHmac("sha256", env.aliexpressAppSecret).update(signSource).digest("hex").toUpperCase();
}

async function aliCall(method: string, extra: AliParams) {
  const params: AliParams = {
    app_key: env.aliexpressAppKey,
    method,
    sign_method: "sha256",
    timestamp: new Date().toISOString().slice(0, 19).replace("T", " "),
    format: "json",
    v: "2.0",
    ...extra,
  };
  if (env.aliexpressAccessToken) params.access_token = env.aliexpressAccessToken;
  params.sign = sign(params);

  const res = await fetch("https://api-sg.aliexpress.com/sync", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  if (!res.ok) {
    throw new Error(`AliExpress API ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as {
    error_response?: { msg?: string; sub_msg?: string };
    [key: string]: unknown;
  };
  if (json.error_response?.msg) {
    throw new Error(json.error_response.sub_msg || json.error_response.msg);
  }
  return json;
}

function asList<T>(value: T | T[] | undefined | null): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function num(v: unknown, fallback = 0) {
  const n = parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : fallback;
}

export async function fetchAliExpressProduct(url: string): Promise<ParsedSupplierPayload> {
  const productId = extractProductId(url);
  const json = await aliCall("aliexpress.ds.product.get", {
    product_id: productId,
    ship_to_country: "US",
    target_currency: "USD",
    target_language: "en",
  });

  const envelope = json.aliexpress_ds_product_get_response as
    | {
        result?: {
          ae_item_base_info_dto?: { subject?: string; delivery_time?: string };
          ae_item_sku_info_dtos?: {
            ae_item_sku_info_d_t_o?: Array<{
              sku_id?: string;
              sku_attr?: string;
              offer_sale_price?: string;
              sku_available_stock?: number;
              sku_image?: string;
            }>;
          };
          ae_multimedia_info_dto?: { image_urls?: string };
          logistics_info_dto?: { delivery_time?: string };
        };
      }
    | undefined;

  const result = envelope?.result;
  const skus = asList(result?.ae_item_sku_info_dtos?.ae_item_sku_info_d_t_o);
  const images = (result?.ae_multimedia_info_dto?.image_urls ?? "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  const variants = skus.map((sku) => ({
    skuId: String(sku.sku_id ?? "default"),
    attributes: humanizeVariantLabel(sku.sku_attr || "Default"),
    cost: num(sku.offer_sale_price),
    stock: sku.sku_available_stock || 0,
    imageUrl: sku.sku_image || images[0],
  }));

  const days = num(result?.logistics_info_dto?.delivery_time || result?.ae_item_base_info_dto?.delivery_time, 14);

  return {
    title: result?.ae_item_base_info_dto?.subject || "AliExpress product",
    baseCost: variants[0]?.cost ?? 0,
    shippingCost: 0,
    shippingDays: Math.max(1, Math.round(days)),
    source: "aliexpress",
    galleryImages: images,
    variants,
  };
}

type RecommendProduct = {
  product_id?: string | number;
  product_title?: string;
  product_main_image_url?: string;
  target_sale_price?: string | number;
  target_original_price?: string | number;
  lastest_volume?: string | number;
  evaluate_rate?: string;
};

type FeedNamePromo = { promo_name?: string };

function extractProducts(json: Record<string, unknown>): RecommendProduct[] {
  const envelope = json.aliexpress_ds_recommend_feed_get_response as
    | {
        result?: {
          products?: { traffic_product_d_t_o?: RecommendProduct[] } | RecommendProduct[];
        };
      }
    | undefined;
  const products = envelope?.result?.products;
  if (Array.isArray(products)) return products;
  return asList(products?.traffic_product_d_t_o);
}

const STOP = new Set(["the", "and", "for", "with", "from", "that", "this"]);

function queryWords(query: string) {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !STOP.has(word));
}

function titleMatches(title: string, words: string[]) {
  const hay = title.toLowerCase();
  if (!words.length) return false;
  const hits = words.filter((word) => hay.includes(word)).length;
  if (words.length === 1) return hits === 1;
  return hits >= Math.ceil(words.length * 0.6);
}

function scoreFeed(name: string, query: string) {
  const hay = name.toLowerCase().replace(/[_&]+/g, " ");
  const words = queryWords(query);
  let score = 0;
  for (const word of words) {
    if (hay.includes(word)) score += 5;
  }
  if (/phone|stand|holder|case|charger|cable/.test(query) && /phone|electronic|consumer/.test(hay)) score += 3;
  if (/home|kitchen|gadget/.test(query) && /home|kitchen/.test(hay)) score += 3;
  if (/beauty|skin|health/.test(query) && /beauty|health/.test(hay)) score += 3;
  if (/car|auto/.test(query) && /auto|car/.test(hay)) score += 3;
  if (/pet/.test(query) && /pet/.test(hay)) score += 3;
  if (/fan|neck|cooling/.test(query) && /electronic|summer|home|gadget/.test(hay)) score += 2;
  if (/^ds[_\s]/.test(hay) && /bestseller|topseller/.test(hay)) score += 1;
  if (/us |ship.?to.?us|_us_/.test(hay)) score += 1;
  return score;
}

async function listFeedNames() {
  const json = await aliCall("aliexpress.ds.feedname.get", { app_signature: "setostore" });
  const envelope = json.aliexpress_ds_feedname_get_response as
    | {
        resp_result?: { result?: { promos?: { promo?: FeedNamePromo | FeedNamePromo[] } } };
      }
    | undefined;
  return asList(envelope?.resp_result?.result?.promos?.promo)
    .map((promo) => promo.promo_name?.trim() ?? "")
    .filter(Boolean);
}

function pickFeeds(names: string[], query: string) {
  const ranked = names
    .map((name) => ({ name, score: scoreFeed(name, query) }))
    .sort((a, b) => b.score - a.score);
  const matched = ranked.filter((item) => item.score >= 4).slice(0, 4).map((item) => item.name);
  if (matched.length) return matched;
  return names.filter((name) => /^DS_/i.test(name) && /bestseller/i.test(name)).slice(0, 6);
}

function toFeedProduct(item: RecommendProduct): FeedProduct | null {
  const id = String(item.product_id ?? "");
  if (!id) return null;
  const cost = num(item.target_sale_price);
  const orders = num(item.lastest_volume);
  const title = item.product_title || "AliExpress listing";
  return {
    id: `ali_${id}`,
    title,
    cleanTitle: title.split(" ").slice(0, 8).join(" "),
    url: `https://www.aliexpress.com/item/${id}.html`,
    source: "aliexpress",
    supplierName: "AliExpress",
    niche: "general",
    cost,
    shipping: 0,
    shippingDays: 14,
    stock: orders > 0 ? Math.max(50, Math.round(orders)) : 100,
    demand: Math.min(1, orders / 5000),
    orders30d: orders,
    image: item.product_main_image_url || "",
    tags: ["aliexpress", "live"],
    live: true,
    variants: [{ skuId: id, attributes: "Default", cost, stock: Math.round(orders) || 0 }],
  };
}

function collectProducts(pages: Array<Record<string, unknown> | null>, seen: Set<string>) {
  const mapped: FeedProduct[] = [];
  for (const page of pages) {
    if (!page) continue;
    for (const item of extractProducts(page)) {
      const product = toFeedProduct(item);
      if (!product || seen.has(product.id)) continue;
      seen.add(product.id);
      mapped.push(product);
    }
  }
  return mapped;
}

function decodeAliTitle(raw: string) {
  return raw
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/\\"/g, '"')
    .trim();
}

function isProductTitle(title: string) {
  if (title.length < 8) return false;
  return !/dollar express|aliexpress|^search$|^log in$|^sign in$/i.test(title);
}

function collectHtmlListings(html: string) {
  const found = new Map<string, RecommendProduct>();
  const patterns = [
    /"productId"\s*:\s*"?(?<id>\d{10,})"?[\s\S]{0,1400}?"(?:displayTitle|productTitle)"\s*:\s*"(?<title>(?:\\.|[^"\\])+)"/gi,
    /"productId"\s*:\s*"?(?<id>\d{10,})"?[\s\S]{0,800}?"title"\s*:\s*"(?<title>(?:\\.|[^"\\])+)"/gi,
    /\/item\/(?<id>\d{10,})\.html[\s\S]{0,1800}?alt="(?<title>[^"]{8,200})"/gi,
  ];
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const id = match.groups?.id;
      const title = decodeAliTitle(match.groups?.title ?? "");
      if (!id || found.has(id) || !isProductTitle(title)) continue;
      found.set(id, { product_id: id, product_title: title });
    }
  }
  return [...found.values()];
}

async function searchAliExpressHtml(query: string): Promise<RecommendProduct[]> {
  const slug = query.trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/gi, "");
  if (slug.length < 2) return [];
  const urls = [
    `https://www.aliexpress.com/w/wholesale-${encodeURIComponent(slug)}.html`,
    `https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(query.trim())}`,
  ];
  for (const url of urls) {
    try {
      const { html, blocked } = await fetchAliExpressHtml(url);
      if (blocked) continue;
      const hits = collectHtmlListings(html);
      if (hits.length) return hits.slice(0, 24);
    } catch {
      // Try the next public search URL.
    }
  }
  return [];
}

export async function searchAliExpress(keyword: string, niche = "all"): Promise<FeedProduct[]> {
  if (!env.aliexpressAppKey || !env.aliexpressAppSecret) return [];

  const words = queryWords(keyword);
  const feedQuery = [keyword.trim(), niche !== "all" ? niche : ""].filter(Boolean).join(" ");
  const seen = new Set<string>();

  try {
    const htmlHits = await searchAliExpressHtml(keyword.trim());
    const fromHtml = htmlHits
      .map(toFeedProduct)
      .filter((p): p is FeedProduct => Boolean(p && titleMatches(p.title, words) && !seen.has(p.id)));
    for (const product of fromHtml) seen.add(product.id);
    if (fromHtml.length >= 8) return fromHtml.slice(0, 24);
    if (fromHtml.length) {
      const extra = await searchFromFeeds(feedQuery, words, seen);
      return [...fromHtml, ...extra].slice(0, 24);
    }
  } catch {
    // Feed search still runs if the public listing page is blocked.
  }

  return searchFromFeeds(feedQuery, words, seen);
}

async function searchFromFeeds(query: string, words: string[], seen: Set<string>) {
  const names = await listFeedNames();
  const feeds = pickFeeds(names, query);
  const pages = await Promise.all(
    feeds.map((feed_name) =>
      aliCall("aliexpress.ds.recommend.feed.get", {
        feed_name,
        page_size: "50",
        country: "US",
        target_currency: "USD",
        target_language: "EN",
        sort: "last_volume_desc",
      }).catch(() => null),
    ),
  );
  return collectProducts(pages, seen).filter((product) => titleMatches(product.title, words)).slice(0, 24);
}
