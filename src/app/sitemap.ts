import type { MetadataRoute } from "next";
import { appOrigin } from "@/lib/stripe";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = appOrigin();
  return [
    { url: `${origin}/pricing`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${origin}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${origin}/terms`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
