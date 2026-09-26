import "server-only";

import { integrationStatus } from "./env";
import type { FeedProduct } from "./supplier-feed";
import { extractAliExpressProductId } from "./aliexpress-url";

export type DiscoverSearchResult = {
  mode: "live";
  items: FeedProduct[];
  error?: string;
  sources: Array<"aliexpress" | "cj">;
};

/** Merge live supplier catalogs. Never returns demo/sample products. */
export async function searchLiveSuppliers(
  query: string,
  niche = "all",
): Promise<DiscoverSearchResult> {
  const q = query.trim();
  const canSearch = q.length >= 2 || niche !== "all";
  if (!canSearch) {
    return { mode: "live", items: [], sources: [], error: undefined };
  }

  const status = integrationStatus();
  const sources: Array<"aliexpress" | "cj"> = [];
  const tasks: Array<Promise<FeedProduct[]>> = [];

  // AliExpress: public HTML search always; Open API feeds when keys exist.
  sources.push("aliexpress");
  tasks.push(
    import("./integrations/aliexpress").then(({ searchAliExpress }) =>
      searchAliExpress(q, niche).catch(() => [] as FeedProduct[]),
    ),
  );

  if (status.cj) {
    sources.push("cj");
    tasks.push(
      import("./integrations/cj").then(({ searchCjDropshipping }) =>
        searchCjDropshipping(q, niche).catch(() => [] as FeedProduct[]),
      ),
    );
  }

  const batches = await Promise.all(tasks);
  const seen = new Set<string>();
  const items: FeedProduct[] = [];
  for (const batch of batches) {
    for (const item of batch) {
      const id = extractAliExpressProductId(item.url);
      const key = id || item.url.split("?")[0] || item.id;
      const titleKey = `${item.source}:${item.cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, "")}`;
      if (seen.has(key) || (titleKey.length > 16 && seen.has(titleKey))) continue;
      seen.add(key);
      if (titleKey.length > 16) seen.add(titleKey);
      items.push(item);
    }
  }

  // Prefer higher demand / orders when ranking mixed sources.
  items.sort((a, b) => (b.orders30d ?? b.demand * 1000) - (a.orders30d ?? a.demand * 1000));

  if (items.length === 0) {
    return {
      mode: "live",
      items: [],
      sources,
      error:
        niche !== "all" && q
          ? `No ${niche} listings matched. Try All, or a more specific product name.`
          : status.cj
            ? "No live AliExpress or CJ listings matched. Try two or three simple words."
            : "No live AliExpress listings matched. Try two or three simple words.",
    };
  }

  return { mode: "live", items: items.slice(0, 36), sources };
}
