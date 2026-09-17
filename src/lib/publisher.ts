import "server-only";

import { GraphQLClient, gql } from "graphql-request";
import { env, integrationStatus } from "./env";
import { getShopifyAdminToken, shopifyCredentialsReady } from "./shopify-token";

export type TransformedProductInput = {
  title: string;
  descriptionHtml: string;
  tags: string[];
  variants: Array<{ sku: string; cost: number; title: string; price: number }>;
};

export type PublishResult = {
  mode: "live" | "demo";
  productId: string;
  handle: string;
  title: string;
  warning?: string;
};

async function client() {
  if (!shopifyCredentialsReady()) return null;
  const token = await getShopifyAdminToken();
  if (!token) return null;
  return new GraphQLClient(
    `https://${env.shopifyDomain}.myshopify.com/admin/api/2026-07/graphql.json`,
    {
      headers: {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json",
      },
    },
  );
}

export async function publishProductToShopify(
  data: TransformedProductInput,
): Promise<PublishResult> {
  const gqlClient = await client();
  if (!gqlClient) {
    return {
      mode: "demo",
      productId: `gid://shopify/Product/demo_${Date.now()}`,
      handle: data.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      title: data.title,
      warning:
        "Shopify is not connected. Product was marked published locally. Add SHOPIFY_STORE_DOMAIN + SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET to push for real.",
    };
  }

  const mutation = gql`
    mutation ProductCreate($input: ProductInput!) {
      productCreate(input: $input) {
        product {
          id
          title
          handle
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const res = (await gqlClient.request(mutation, {
    input: {
      title: data.title,
      descriptionHtml: data.descriptionHtml,
      vendor: "SetoStore",
      status: "DRAFT",
      tags: data.tags,
    },
  })) as {
    productCreate: {
      product?: { id: string; title: string; handle: string };
      userErrors: Array<{ field?: string[]; message: string }>;
    };
  };

  if (res.productCreate.userErrors.length > 0) {
    throw new Error(`Shopify publishing failed: ${JSON.stringify(res.productCreate.userErrors)}`);
  }

  const product = res.productCreate.product;
  if (!product) throw new Error("Shopify returned no product.");
  return { mode: "live", productId: product.id, handle: product.handle, title: product.title };
}

export function shopifyConnected() {
  return integrationStatus().shopify;
}
