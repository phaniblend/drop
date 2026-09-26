import "server-only";

import { eq } from "drizzle-orm";
import { ensureDb } from "./db";
import { getOperator, getProduct } from "./db/queries";
import { productVariants, products } from "./db/schema";
import { appOrigin } from "./stripe";
import { env } from "./env";
import { publicHtmlLeaksOperatorCopy, toPublicProduct, type PublicStoreProduct } from "./shopper-copy";
import { MIN_PUBLISH_PRICE, screenListing } from "./product-screen";

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

async function persistCleanCopy(id: string, nextHtml: string, prevHtml: string | null) {
  if (nextHtml === (prevHtml ?? "")) return;
  const db = await ensureDb();
  await db.update(products).set({ descriptionHtml: nextHtml }).where(eq(products.id, id));
}

export async function listLiveStoreProducts(): Promise<PublicStoreProduct[]> {
  const db = await ensureDb();
  const rows = await db.select().from(products).where(eq(products.status, "published"));
  const variants = await db.select().from(productVariants);
  const byProduct = new Map<string, typeof variants>();
  for (const variant of variants) {
    const list = byProduct.get(variant.productId) ?? [];
    list.push(variant);
    byProduct.set(variant.productId, list);
  }

  const published: PublicStoreProduct[] = [];
  for (const product of rows) {
    const vars = byProduct.get(product.id) ?? [];
    if (!(product.retailPrice > 0 || vars.some((v) => v.variantPrice > 0))) continue;
    const pub = toPublicProduct({ ...product, variants: vars });
    if (publicHtmlLeaksOperatorCopy(product.descriptionHtml ?? "", product.baseCost)) {
      await persistCleanCopy(product.id, pub.descriptionHtml, product.descriptionHtml);
    }
    published.push(pub);
  }
  return published;
}

export async function getLiveStoreProduct(id: string): Promise<PublicStoreProduct | null> {
  const db = await ensureDb();
  const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!product || product.status !== "published") return null;
  const variants = await db.select().from(productVariants).where(eq(productVariants.productId, id));
  const pub = toPublicProduct({ ...product, variants });
  if (publicHtmlLeaksOperatorCopy(product.descriptionHtml ?? "", product.baseCost)) {
    await persistCleanCopy(product.id, pub.descriptionHtml, product.descriptionHtml);
  }
  return pub;
}

export type PublishStoreResult = {
  mode: "live";
  productId: string;
  handle: string;
  title: string;
  storeUrl: string;
  firstShop: boolean;
};

export async function publishLiveProduct(
  productId: string,
  opts: { allowUnknownShipping?: boolean; allowRestricted?: boolean } = {},
): Promise<PublishStoreResult> {
  const product = await getProduct(productId);
  if (!product) throw new Error("Product not found.");
  const screen = screenListing({
    title: `${product.cleanTitle ?? ""} ${product.rawTitle}`,
    description: product.descriptionHtml ?? "",
  });
  if (!screen.ok && screen.level === "block") throw new Error(screen.reason);
  if (!screen.ok && screen.level === "review" && !opts.allowRestricted) throw new Error(screen.reason);
  if (product.shippingCost <= 0 && !opts.allowUnknownShipping) {
    throw new Error("Enter supplier shipping before publishing, or confirm you want to publish without it.");
  }
  if (product.retailPrice > 0 && product.retailPrice < MIN_PUBLISH_PRICE) {
    throw new Error(`Selling under $${MIN_PUBLISH_PRICE.toFixed(2)} rarely covers ads. Raise the price or keep it as a draft.`);
  }
  const db = await ensureDb();
  const live = await db.select({ id: products.id }).from(products).where(eq(products.status, "published"));
  const firstShop = live.length === 0;
  const storeId = `seto_${product.id}`;
  const pub = toPublicProduct({ ...product, variants: product.variants });
  await persistCleanCopy(product.id, pub.descriptionHtml, product.descriptionHtml);
  await db
    .update(products)
    .set({ status: "published", shopifyProductId: storeId })
    .where(eq(products.id, productId));
  return {
    mode: "live",
    productId: storeId,
    handle: product.id,
    title: product.cleanTitle || product.rawTitle,
    storeUrl: storeProductUrl(product.id),
    firstShop,
  };
}
