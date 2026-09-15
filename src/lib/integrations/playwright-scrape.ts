import "server-only";

import type { ParsedSupplierPayload } from "../scraper";

/**
 * Optional Playwright path from the design spec.
 * Not bundled as a hard dependency — AliExpress Open API or the demo feed are preferred.
 * To enable: `npm i playwright && npx playwright install chromium`, set ENABLE_HEADLESS_SCRAPE=true,
 * and provide residential proxies yourself (I cannot buy those).
 */
export async function scrapeWithPlaywright(_targetUrl: string): Promise<ParsedSupplierPayload> {
  throw new Error(
    "Headless scrape is not enabled in this install. Use Discover, CSV import, or AliExpress API keys. To wire Playwright, install the playwright package and add proxy credentials.",
  );
}
