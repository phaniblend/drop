import "server-only";

import { canonicalAliExpressUrl } from "../aliexpress-url";
import { fetchAliExpressHtml, listingFromHtml } from "./http";
import type { ScrapedListing } from "./types";

export async function scrapeAliExpressListing(rawUrl: string): Promise<ScrapedListing> {
  const supplierUrl = canonicalAliExpressUrl(rawUrl);

  try {
    const { html, blocked } = await fetchAliExpressHtml(supplierUrl);
    if (!blocked) {
      try {
        return listingFromHtml(html, supplierUrl);
      } catch {
        /* fall through to Playwright */
      }
    }
  } catch {
    /* fall through to Playwright */
  }

  if (process.env.PLAYWRIGHT_ENABLED === "1") {
    const { scrapeAliExpressWithPlaywright } = await import("../integrations/playwright-scrape");
    return scrapeAliExpressWithPlaywright(supplierUrl);
  }

  throw new Error("Could not read that AliExpress listing. Try again in a moment.");
}
