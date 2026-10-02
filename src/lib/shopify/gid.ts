import { createHash } from "node:crypto";

export function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function hashCustomerId(storeId: string, customerGid: string) {
  return sha256Hex(`${storeId}${customerGid}`);
}

export function asOrderGid(id: string | number | null | undefined) {
  const raw = String(id ?? "").trim();
  if (!raw) return "";
  if (raw.startsWith("gid://shopify/Order/")) return raw;
  if (/^\d+$/.test(raw)) return `gid://shopify/Order/${raw}`;
  return raw;
}

export function extractResourceGid(topic: string, payload: Record<string, unknown>) {
  if (topic.startsWith("orders/")) {
    return (
      asOrderGid(payload.admin_graphql_api_id as string) ||
      asOrderGid(payload.id as string | number)
    );
  }
  if (topic === "refunds/create") {
    const order = payload.order as { admin_graphql_api_id?: string; id?: string | number } | undefined;
    return (
      asOrderGid(order?.admin_graphql_api_id) ||
      asOrderGid(payload.order_id as string | number) ||
      asOrderGid(order?.id)
    );
  }
  return null;
}

export function normalizeShopDomainHost(shop: string) {
  return shop
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .replace(/\.myshopify\.com$/i, "");
}
