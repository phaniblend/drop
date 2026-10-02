import { and, eq, isNull } from "drizzle-orm";
import { variantCosts } from "../db/schema-guard";
import { nid, nowIso } from "../utils";
import { shopifyApiHost } from "./sync-order";

type Db = Awaited<ReturnType<typeof import("../db").ensureDb>>;

const VARIANT_COSTS_QUERY = `
query VariantCosts($cursor: String) {
  productVariants(first: 50, after: $cursor) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id
      sku
      product { id }
      inventoryItem { unitCost { amount } }
    }
  }
}
`;

export type ShopifyVariantCostNode = {
  id: string;
  sku?: string | null;
  product?: { id?: string } | null;
  inventoryItem?: { unitCost?: { amount?: string } | null } | null;
};

export async function fetchShopifyVariantCosts(shopDomain: string, token: string) {
  const nodes: ShopifyVariantCostNode[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 40; page += 1) {
    const res = await fetch(`https://${shopifyApiHost(shopDomain)}/admin/api/2026-07/graphql.json`, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: VARIANT_COSTS_QUERY, variables: { cursor } }),
    });
    if (!res.ok) throw new Error(`Shopify COGS import failed (${res.status}).`);
    const json = (await res.json()) as {
      data?: {
        productVariants?: {
          pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
          nodes?: ShopifyVariantCostNode[];
        };
      };
    };
    nodes.push(...(json.data?.productVariants?.nodes ?? []));
    if (!json.data?.productVariants?.pageInfo?.hasNextPage) break;
    cursor = json.data?.productVariants?.pageInfo?.endCursor ?? null;
    if (!cursor) break;
  }
  return nodes;
}

export async function importVariantCostsFromShopify(input: {
  db: Db;
  storeId: string;
  shopDomain: string;
  token: string;
  fetchCosts?: typeof fetchShopifyVariantCosts;
}) {
  const fetchCosts = input.fetchCosts ?? fetchShopifyVariantCosts;
  const nodes = await fetchCosts(input.shopDomain, input.token);
  const now = nowIso();
  let written = 0;
  for (const node of nodes) {
    const amount = Number(node.inventoryItem?.unitCost?.amount ?? NaN);
    if (!Number.isFinite(amount) || amount < 0) continue;
    const productId = node.product?.id;
    if (!productId) continue;

    const [open] = await input.db
      .select()
      .from(variantCosts)
      .where(
        and(
          eq(variantCosts.storeId, input.storeId),
          eq(variantCosts.shopifyVariantId, node.id),
          eq(variantCosts.source, "SHOPIFY_UNIT_COST"),
          isNull(variantCosts.effectiveTo),
        ),
      )
      .limit(1);

    if (open && Math.abs(open.unitCogs - amount) < 0.005) continue;
    if (open) {
      await input.db
        .update(variantCosts)
        .set({ effectiveTo: now })
        .where(eq(variantCosts.id, open.id));
    }
    await input.db.insert(variantCosts).values({
      id: nid("vcost"),
      storeId: input.storeId,
      shopifyVariantId: node.id,
      shopifyProductId: productId,
      sku: node.sku ?? null,
      unitCogs: amount,
      unitShippingCost: 0,
      source: "SHOPIFY_UNIT_COST",
      effectiveFrom: now,
      effectiveTo: null,
      createdAt: now,
    });
    written += 1;
  }
  return { scanned: nodes.length, written };
}
