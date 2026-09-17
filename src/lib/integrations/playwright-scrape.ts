import "server-only";

import { chromium } from "playwright";
import { extractAliExpressListing } from "../aliexpress-scrape/extract";
import { BROWSER_HEADERS } from "../aliexpress-scrape/http";
import type { ScrapedListing } from "../aliexpress-scrape/types";

export async function scrapeAliExpressWithPlaywright(targetUrl: string): Promise<ScrapedListing> {
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const context = await browser.newContext({
      userAgent: BROWSER_HEADERS["User-Agent"],
      locale: "en-US",
      extraHTTPHeaders: {
        "Accept-Language": BROWSER_HEADERS["Accept-Language"],
        "Sec-Ch-Ua": BROWSER_HEADERS["Sec-Ch-Ua"],
        "Sec-Ch-Ua-Mobile": BROWSER_HEADERS["Sec-Ch-Ua-Mobile"],
        "Sec-Ch-Ua-Platform": BROWSER_HEADERS["Sec-Ch-Ua-Platform"],
      },
      viewport: { width: 1365, height: 900 },
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    const page = await context.newPage();
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => undefined);
    const html = await page.content();
    return extractAliExpressListing(html, targetUrl);
  } finally {
    await browser.close();
  }
}
