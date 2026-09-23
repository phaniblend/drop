import "server-only";

import { resolveShopifyConnection, shopifyIsConnected } from "./shopify-oauth";

export async function shopifyCredentialsReady() {
  return shopifyIsConnected();
}

export async function getShopifyAdminToken() {
  const conn = await resolveShopifyConnection();
  return conn?.token ?? "";
}

export async function getShopifyDomain() {
  const conn = await resolveShopifyConnection();
  return conn?.domain ?? "";
}
