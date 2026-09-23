import "server-only";

import { env } from "../env";
import { matchesNiche, queryWords, titleMatches } from "../aliexpress-search-html";
import type { FeedProduct } from "../supplier-feed";
import { normalizeSupplierStock } from "../supplier-stock";

const CJ_BASE = "https://developers.cjdropshipping.com/api2.0/v1";

type CjTokenCache = { token: string; expiresAt: number };
const globalForCj = globalThis as unknown as { setoCjToken?: CjTokenCache };

function num(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const n = parseFloat(String(value ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

async function getCjAccessToken(): Promise<string | null> {
  const apiKey = env.cjApiKey;
  if (!apiKey) return null;

  const cached = globalForCj.setoCjToken;
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const res = await fetch(`${CJ_BASE}/authentication/getAccessToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    data?: { accessToken?: string; accessTokenExpiryDate?: string };
    result?: boolean;
  };
  const token = json.data?.accessToken;
  if (!token) return null;

  const expiry = json.data?.accessTokenExpiryDate
    ? Date.parse(json.data.accessTokenExpiryDate)
    : Date.now() + 12 * 60 * 60 * 1000;
  globalForCj.setoCjToken = {
    token,
    expiresAt: Number.isFinite(expiry) ? expiry : Date.now() + 12 * 60 * 60 * 1000,
  };
  return token;
}

type CjProduct = {
  pid?: string | number;
  productId?: string | number;
  productNameEn?: string;
  productName?: string;
  productImage?: string;
  productImageUrl?: string;
  sellPrice?: string | number;
  nowPrice?: string | number;
  discountPrice?: string | number;
  warehouseInventoryNum?: number | string;
  listedNum?: number | string;
  productUrl?: string;
};

function toFeedProduct(item: CjProduct): FeedProduct | null {
  const id = String(item.pid ?? item.productId ?? "");
  if (!id) return null;
  const title = String(item.productNameEn || item.productName || "CJ listing").trim();
  const cost = num(item.discountPrice ?? item.nowPrice ?? item.sellPrice);
  const stock = normalizeSupplierStock(num(item.warehouseInventoryNum));
  const orders = num(item.listedNum);
  const image = String(item.productImageUrl || item.productImage || "");
  const url =
    String(item.productUrl || "").trim() ||
    `https://cjdropshipping.com/product/detail/${id}`;

  return {
    id: `cj_${id}`,
    title,
    cleanTitle: title.split(/\s+/).slice(0, 8).join(" "),
    url,
    source: "cj",
    supplierName: "CJ Dropshipping",
    niche: "general",
    cost,
    shipping: 0,
    shippingDays: 7,
    stock: stock || 0,
    stockKnown: stock > 0,
    demand: Math.min(1, orders / 5000),
    orders30d: orders > 0 ? orders : undefined,
    image,
    tags: ["cj", "live"],
    live: true,
    variants: [{ skuId: id, attributes: "Default", cost, stock: stock || 0 }],
  };
}

/** Live CJ catalog search — requires CJ_API_KEY. */
export async function searchCjDropshipping(keyword: string, niche = "all"): Promise<FeedProduct[]> {
  const token = await getCjAccessToken();
  if (!token) return [];

  const searchText = keyword.trim() || (niche !== "all" ? niche : "");
  if (searchText.length < 2 && niche === "all") return [];

  const words = queryWords(searchText);
  const params = new URLSearchParams({
    page: "1",
    size: "24",
    keyWord: searchText || niche,
    countryCode: "US",
  });

  const res = await fetch(`${CJ_BASE}/product/listV2?${params}`, {
    headers: {
      "CJ-Access-Token": token,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) return [];

  const json = (await res.json()) as {
    data?: { list?: CjProduct[]; content?: CjProduct[] } | CjProduct[];
  };
  const raw = json.data;
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.list)
      ? raw.list
      : Array.isArray(raw?.content)
        ? raw.content
        : [];

  const mapped = list
    .map(toFeedProduct)
    .filter((p): p is FeedProduct => Boolean(p))
    .filter((p) => !words.length || titleMatches(p.title, words));

  if (niche === "all") return mapped.slice(0, 24);
  return mapped.filter((p) => matchesNiche(p.title, niche)).slice(0, 24);
}

export function isCjProductUrl(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.includes("cjdropshipping.com") || host.includes("cjdropshipping.cn");
  } catch {
    return false;
  }
}

/** Extract CJ pid from common product URL shapes. */
export function extractCjProductId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;
    const detail = path.match(/\/product\/detail\/([^/?#]+)/i);
    if (detail?.[1]) return decodeURIComponent(detail[1]);
    const uuid = path.match(
      /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
    );
    if (uuid?.[1]) return uuid[1];
    const q = parsed.searchParams.get("pid") || parsed.searchParams.get("id");
    if (q) return q;
    return null;
  } catch {
    return null;
  }
}

type CjVariant = {
  vid?: string;
  variantSku?: string;
  variantNameEn?: string;
  variantName?: string;
  variantKey?: string;
  variantSellPrice?: number | string;
  inventories?: Array<{ totalInventory?: number | string; cjInventory?: number | string }>;
};

type CjDetail = CjProduct & {
  bigImage?: string;
  productImageSet?: string[];
  variants?: CjVariant[];
};

function variantStock(v: CjVariant) {
  const inv = v.inventories?.[0];
  return normalizeSupplierStock(num(inv?.totalInventory ?? inv?.cjInventory));
}

/** Full product detail for URL paste / deep import. Requires CJ_API_KEY. */
export async function fetchCjProduct(url: string): Promise<import("../scraper").ParsedSupplierPayload> {
  const token = await getCjAccessToken();
  if (!token) {
    throw new Error("Add CJ_API_KEY on Railway to import CJ product URLs.");
  }
  const pid = extractCjProductId(url);
  if (!pid) {
    throw new Error("Could not find a CJ product id in that URL. Open the product page and copy the full link.");
  }

  const res = await fetch(
    `${CJ_BASE}/product/query?${new URLSearchParams({ pid, countryCode: "US" })}`,
    {
      headers: {
        "CJ-Access-Token": token,
        "Content-Type": "application/json",
      },
    },
  );
  if (!res.ok) {
    throw new Error(`CJ product lookup failed (${res.status}).`);
  }
  const json = (await res.json()) as { data?: CjDetail; result?: boolean; message?: string };
  const data = json.data;
  if (!data?.pid && !data?.productId) {
    throw new Error(json.message || "CJ returned no product for that URL.");
  }

  const title = String(data.productNameEn || data.productName || "CJ listing").trim();
  const images = [
    ...(Array.isArray(data.productImageSet) ? data.productImageSet : []),
    String(data.bigImage || data.productImageUrl || data.productImage || ""),
  ].filter(Boolean);
  const variantsRaw = Array.isArray(data.variants) ? data.variants : [];
  const baseCost = num(data.discountPrice ?? data.nowPrice ?? data.sellPrice);

  const variants =
    variantsRaw.length > 0
      ? variantsRaw.map((v) => ({
          skuId: String(v.vid || v.variantSku || pid),
          attributes: String(v.variantNameEn || v.variantName || v.variantKey || "Default"),
          cost: num(v.variantSellPrice, baseCost),
          stock: variantStock(v),
          imageUrl: images[0],
        }))
      : [
          {
            skuId: String(pid),
            attributes: "Default",
            cost: baseCost,
            stock: normalizeSupplierStock(num(data.warehouseInventoryNum)),
            imageUrl: images[0],
          },
        ];

  return {
    title,
    baseCost: variants[0]?.cost ?? baseCost,
    shippingCost: 0,
    shippingDays: 7,
    source: "cj",
    galleryImages: images,
    variants,
    importPath: "catalog",
  };
}
