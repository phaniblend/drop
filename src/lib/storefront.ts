import "server-only";

import { eq } from "drizzle-orm";
import { ensureDb } from "./db";
import { getOperator } from "./db/queries";
import { productVariants, products } from "./db/schema";
import { appOrigin } from "./stripe";
import { env } from "./env";

export type StoreProduct = Awaited<ReturnType<typeof listLiveStoreProducts>>[number];

export function storePath(productId: string) {
  return `/store/${productId}`;
}

export function storeProductUrl(productId: string) {
  return `${appOrigin()}${storePath(productId)}`;
}

export function storeHomeUrl() {
  return `${appOrigin()}/store`;
}

export async function getStorefrontBrand() {
  const user = await getOperator();
  return {
    name: user?.storeName || "SetoStore",
    stripeReady: Boolean(env.stripeSecretKey),
  };
}

export async function listLiveStoreProducts() {
  const db = await ensureDb();
  const rows = await db.select().from(products).where(eq(products.status, "published"));
  const variants = await db.select().from(productVariants);
  const byProduct = new Map<string, typeof variants>();
  for (const variant of variants) {
    const list = byProduct.get(variant.productId) ?? [];
    list.push(variant);
    byProduct.set(variant.productId, list);
  }
  return rows
    .map((product) => ({
      ...product,
      variants: byProduct.get(product.id) ?? [],
    }))
    .filter((product) => product.retailPrice > 0 || product.variants.some((v) => v.variantPrice > 0));
}

export async function getLiveStoreProduct(id: string) {
  const db = await ensureDb();
  const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!product || product.status !== "published") return null;
  const variants = await db.select().from(productVariants).where(eq(productVariants.productId, id));
  return { ...product, variants };
}

export type PublishStoreResult = {
  mode: "live";
  productId: string;
  handle: string;
  title: string;
  storeUrl: string;
};

export function publishProductToStore(input: { id: string; title: string }): PublishStoreResult {
  return {
    mode: "live",
    productId: `seto_${input.id}`,
    handle: input.id,
    title: input.title,
    storeUrl: storeProductUrl(input.id),
  };
}
