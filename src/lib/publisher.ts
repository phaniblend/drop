import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import { GraphQLClient, gql } from "graphql-request";
import { env, integrationStatus } from "./env";
import { resolveShopifyConnection, shopifyIsConnected } from "./shopify-oauth";

export type TransformedProductInput = {
  title: string;
  descriptionHtml: string;
  tags: string[];
  variants: Array<{ sku: string; cost: number; title: string; price: number }>;
};

export type PublishResult = {
  mode: "live" | "local_only";
  productId: string;
  handle: string;
  title: string;
  warning?: string;
  adminUrl?: string;
};

async function client() {
  const conn = await resolveShopifyConnection();
  if (!conn) return null;
  return new GraphQLClient(
    `https://${conn.domain}.myshopify.com/admin/api/2026-07/graphql.json`,
    {
      headers: {
        "X-Shopify-Access-Token": conn.token,
        "Content-Type": "application/json",
      },
    },
  );
}

function slugHandle(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export async function publishProductToShopify(
  data: TransformedProductInput,
): Promise<PublishResult> {
  const gqlClient = await client();
  if (!gqlClient) {
    return {
      mode: "local_only",
      productId: "",
      handle: slugHandle(data.title),
      title: data.title,
      warning:
        "Shopify is not connected (or the token failed). Saved as Local only — not published to Shopify.",
    };
  }

  const variants =
    data.variants.length > 0
      ? data.variants
      : [{ sku: "DEFAULT", cost: 0, title: "Default", price: 0 }];

  const optionValues = variants.map((v, i) => ({
    name: (v.title || `Option ${i + 1}`).slice(0, 100),
  }));

  try {
    const createMutation = gql`
      mutation ProductCreate($product: ProductCreateInput!) {
        productCreate(product: $product) {
          product {
            id
            title
            handle
            variants(first: 50) {
              nodes {
                id
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const created = (await gqlClient.request(createMutation, {
      product: {
        title: data.title,
        descriptionHtml: data.descriptionHtml,
        vendor: "SetoStore",
        status: "DRAFT",
        tags: data.tags,
        productOptions: [
          {
            name: "Title",
            values: optionValues,
          },
        ],
      },
    })) as {
      productCreate: {
        product?: {
          id: string;
          title: string;
          handle: string;
          variants?: { nodes: Array<{ id: string }> };
        };
        userErrors: Array<{ field?: string[]; message: string }>;
      };
    };

    if (created.productCreate.userErrors.length > 0) {
      throw new Error(`Shopify publishing failed: ${JSON.stringify(created.productCreate.userErrors)}`);
    }

    const product = created.productCreate.product;
    if (!product) throw new Error("Shopify returned no product.");

    const { shopifyAdminProductUrl } = await import("./publish-status");
    const conn = await resolveShopifyConnection();
    const adminUrl = shopifyAdminProductUrl(conn?.domain || env.shopifyDomain, product.id);

    const variantNodes = product.variants?.nodes ?? [];
    if (variantNodes.length > 0) {
      const bulk = gql`
        mutation ProductVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
          productVariantsBulkUpdate(productId: $productId, variants: $variants) {
            userErrors {
              field
              message
            }
          }
        }
      `;
      const updates = variantNodes.map((node, i) => {
        const v = variants[Math.min(i, variants.length - 1)]!;
        return {
          id: node.id,
          price: String(Number(v.price || 0).toFixed(2)),
          inventoryItem: {
            sku: v.sku || undefined,
            cost: v.cost > 0 ? String(Number(v.cost).toFixed(2)) : undefined,
          },
        };
      });
      const bulkRes = (await gqlClient.request(bulk, {
        productId: product.id,
        variants: updates,
      })) as {
        productVariantsBulkUpdate: { userErrors: Array<{ message: string }> };
      };
      if (bulkRes.productVariantsBulkUpdate.userErrors.length > 0) {
        return {
          mode: "live",
          productId: product.id,
          handle: product.handle,
          title: product.title,
          adminUrl,
          warning: `Product created, but variant prices need a manual check: ${bulkRes.productVariantsBulkUpdate.userErrors[0]?.message}`,
        };
      }
    }

    return {
      mode: "live",
      productId: product.id,
      handle: product.handle,
      title: product.title,
      adminUrl,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Shopify API error";
    console.error("[publishProductToShopify]", msg);
    throw new Error(msg);
  }
}

export async function shopifyConnected() {
  if (await shopifyIsConnected()) return true;
  return integrationStatus().shopify;
}

/** Verify Shopify webhook HMAC (base64). */
export function verifyShopifyWebhookHmac(rawBody: string, hmacHeader: string | null) {
  const secret = env.shopifyWebhookSecret;
  if (!secret) return { ok: true as const, skipped: true };
  if (!hmacHeader) return { ok: false as const, reason: "missing" as const };
  const digest = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  const a = Buffer.from(digest);
  const b = Buffer.from(hmacHeader);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false as const, reason: "mismatch" as const };
  }
  return { ok: true as const, skipped: false };
}
