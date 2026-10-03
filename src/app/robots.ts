import type { MetadataRoute } from "next";
import { appOrigin } from "@/lib/stripe";

export default function robots(): MetadataRoute.Robots {
  const origin = appOrigin();
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/store", "/s/", "/pricing", "/privacy", "/terms"],
      disallow: ["/api/", "/catalog"],
    },
    sitemap: `${origin}/sitemap.xml`,
  };
}
