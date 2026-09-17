import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.name,
    short_name: BRAND.name,
    description: "Source products, manage suppliers, and run fulfillment in one operator desk.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: BRAND.canvas,
    theme_color: BRAND.purple,
    categories: ["business", "productivity", "shopping"],
    icons: [
      { src: "/icon", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon1", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
    shortcuts: [
      { name: "Command", url: "/", short_name: "Today" },
      { name: "Discover", url: "/discover", short_name: "Find SKUs" },
      { name: "Fulfill", url: "/fulfillment", short_name: "Batch" },
    ],
  };
}
