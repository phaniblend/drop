import "server-only";

import { createHmac } from "node:crypto";
import { env } from "../env";
import type { ParsedSupplierPayload } from "../scraper";

function extractProductId(url: string) {
  const match = url.match(/(\d{10,})/);
  return match?.[1] ?? url;
}

export async function fetchAliExpressProduct(url: string): Promise<ParsedSupplierPayload> {
  const productId = extractProductId(url);
  const method = "aliexpress.ds.product.get";
  const params: Record<string, string> = {
    app_key: env.aliexpressAppKey,
    method,
    sign_method: "sha256",
    timestamp: new Date().toISOString().slice(0, 19).replace("T", " "),
    format: "json",
    v: "2.0",
    product_id: productId,
    ship_to_country: "US",
  };
  if (env.aliexpressAccessToken) params.access_token = env.aliexpressAccessToken;

  const signSource = Object.keys(params)
    .sort()
    .map((k) => `${k}${params[k]}`)
    .join("");
  params.sign = createHmac("sha256", env.aliexpressAppSecret)
    .update(signSource)
    .digest("hex")
    .toUpperCase();

  const body = new URLSearchParams(params);
  const res = await fetch("https://api-sg.aliexpress.com/sync", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    throw new Error(`AliExpress API ${res.status}: ${await res.text()}`);
  }

  const json = (await res.json()) as {
    aliexpress_ds_product_get_response?: {
      result?: {
        ae_item_base_info_dto?: { subject?: string };
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
      };
    };
    error_response?: { msg?: string };
  };

  if (json.error_response?.msg) {
    throw new Error(json.error_response.msg);
  }

  const result = json.aliexpress_ds_product_get_response?.result;
  const skus = result?.ae_item_sku_info_dtos?.ae_item_sku_info_d_t_o ?? [];
  const images = (result?.ae_multimedia_info_dto?.image_urls ?? "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  const variants = skus.map((sku) => ({
    skuId: String(sku.sku_id ?? "default"),
    attributes: sku.sku_attr || "Default",
    cost: parseFloat(sku.offer_sale_price || "0"),
    stock: sku.sku_available_stock || 0,
    imageUrl: sku.sku_image,
  }));

  return {
    title: result?.ae_item_base_info_dto?.subject || "AliExpress product",
    baseCost: variants[0]?.cost ?? 0,
    shippingCost: 1.99,
    shippingDays: 14,
    source: "aliexpress",
    galleryImages: images,
    variants,
  };
}

export async function searchAliExpress(keyword: string) {
  if (!env.aliexpressAppKey) return [];
  const params: Record<string, string> = {
    app_key: env.aliexpressAppKey,
    method: "aliexpress.ds.recommend.feed.get",
    sign_method: "sha256",
    timestamp: new Date().toISOString().slice(0, 19).replace("T", " "),
    format: "json",
    v: "2.0",
    keywords: keyword,
    page_size: "12",
  };
  const signSource = Object.keys(params)
    .sort()
    .map((k) => `${k}${params[k]}`)
    .join("");
  params.sign = createHmac("sha256", env.aliexpressAppSecret)
    .update(signSource)
    .digest("hex")
    .toUpperCase();

  const res = await fetch("https://api-sg.aliexpress.com/sync", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  if (!res.ok) return [];
  return res.json();
}
