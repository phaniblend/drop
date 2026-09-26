import type { MetadataRoute } from "next";
import { appOrigin } from "@/lib/stripe";
import { listLiveStoreProducts } from "@/lib/storefront";
import { STORE_POLICIES } from "@/lib/legal";

export default async function sitemap(): MetadataRoute.Sitemap {
  const origin = appOrigin();
  const products = await listLiveStoreProducts().catch(() => []);
  return [
    { url: `${origin}/store`, changeFrequency: "daily", priority: 1 },
    { url: `${origin}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${origin}/terms`, changeFrequency: "yearly", priority: 0.3 },
    ...STORE_POLICIES.map((item) => ({
      url: `${origin}${item.href}`,
      changeFrequency: "monthly" as const,
      priority: 0.4,
    })),
    ...products.map((product) => ({
      url: `${origin}/store/${product.id}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
