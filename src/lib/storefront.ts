import "server-only";

import { and, eq } from "drizzle-orm";
import { ensureDb } from "./db";
import { getOperator, getProduct, getUserById } from "./db/queries";
import { productVariants, products } from "./db/schema";
import { appOrigin } from "./stripe";
import { env } from "./env";
import { stripeCheckoutMode } from "./stripe-mode";
import { publicHtmlLeaksOperatorCopy, toPublicProduct, type PublicStoreProduct } from "./shopper-copy";
import { MIN_PUBLISH_PRICE, screenListing } from "./product-screen";
import { storefrontPath, storeHomePath } from "./store-slug";

export function storePath(productId: string, slug?: string | null) {
  return storefrontPath(slug, productId);
}

export function storeProductUrl(productId: string, slug?: string | null) {
  return `${appOrigin()}${storePath(productId, slug)}`;
}

export function storeHomeUrl(slug?: string | null) {
  return `${appOrigin()}${storeHomePath(slug)}`;
}

export async function getStorefrontBrand(userId?: string) {
  const user = userId ? await getUserById(userId) : await getOperator();
  return {
    name: user?.storeName || "SetoStore",
    slug: user?.storeSlug || "",
    userId: user?.id ?? "",
    stripeReady: Boolean(user?.storeStripeSk || env.stripeSecretKey),
    stripeMode: stripeCheckoutMode(user?.storeStripeSk || env.stripeSecretKey),
    supportEmail: user?.supportEmail?.trim() || user?.email || "",
    businessAddress: user?.businessAddress?.trim() || "",
    metaPixelId: user?.metaPixelId?.trim() || "",
  };
}

async function persistCleanCopy(id: string, nextHtml: string, prevHtml: string | null) {
  if (nextHtml === (prevHtml ?? "")) return;
  const db = await ensureDb();
  await db.update(products).set({ descriptionHtml: nextHtml }).where(eq(products.id, id));
}

export async function listLiveStoreProducts(userId?: string): Promise<PublicStoreProduct[]> {
  if (!userId) return [];
  const db = await ensureDb();
  const rows = await db
    .select()
    .from(products)
    .where(and(eq(products.status, "published"), eq(products.userId, userId)));
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
    published.push(toPublicProduct({ ...product, variants: vars, userId: product.userId }));
  }
  return published;
}

export async function getLiveStoreProduct(id: string): Promise<PublicStoreProduct | null> {
  const db = await ensureDb();
  const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!product || product.status !== "published") return null;
  const variants = await db.select().from(productVariants).where(eq(productVariants.productId, id));
  return toPublicProduct({ ...product, variants, userId: product.userId });
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
  const live = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.status, "published"), eq(products.userId, product.userId)));
  const firstShop = live.length === 0;
  const storeId = `seto_${product.id}`;
  const pub = toPublicProduct({ ...product, variants: product.variants });
  if (publicHtmlLeaksOperatorCopy(product.descriptionHtml ?? "", product.baseCost)) {
    await persistCleanCopy(product.id, pub.descriptionHtml, product.descriptionHtml);
  }
  await db
    .update(products)
    .set({ status: "published", shopifyProductId: storeId })
    .where(eq(products.id, productId));
  return {
    mode: "live",
    productId: storeId,
    handle: product.id,
    title: product.cleanTitle || product.rawTitle,
    storeUrl: storeProductUrl(product.id, (await getUserById(product.userId))?.storeSlug),
    firstShop,
  };
}
