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
    stock: stock || 100,
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
