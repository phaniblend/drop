import "server-only";

import { createHmac } from "node:crypto";
import { env } from "../env";
import type { FeedProduct } from "../supplier-feed";
import type { ParsedSupplierPayload } from "../scraper";

type AliParams = Record<string, string>;

function extractProductId(url: string) {
  const match = url.match(/(\d{10,})/);
  return match?.[1] ?? url;
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
    attributes: sku.sku_attr || "Default",
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

export async function searchAliExpress(keyword: string): Promise<FeedProduct[]> {
  if (!env.aliexpressAppKey || !env.aliexpressAppSecret) return [];

  const json = await aliCall("aliexpress.ds.recommend.feed.get", {
    keywords: keyword.trim() || "home gadgets",
    page_size: "20",
    country: "US",
    target_currency: "USD",
    target_language: "en",
    sort: "volume_desc",
  });

  const envelope = json.aliexpress_ds_recommend_feed_get_response as
    | {
        result?: {
          products?: { traffic_product_d_t_o?: RecommendProduct[] };
        };
      }
    | undefined;

  const raw = asList(envelope?.result?.products?.traffic_product_d_t_o);
  return raw
    .map((item) => {
      const id = String(item.product_id ?? "");
      if (!id) return null;
      const cost = num(item.target_sale_price);
      const orders = num(item.lastest_volume);
      const title = item.product_title || "AliExpress listing";
      const product: FeedProduct = {
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
      return product;
    })
    .filter((p): p is FeedProduct => Boolean(p));
}
