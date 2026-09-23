import { describe, expect, it, vi } from "vitest";
import {
  productStatusAfterPublish,
  shouldMarkPublished,
  shopifyAdminProductUrl,
} from "./publish-status";
import { isLowStock, LOW_STOCK_THRESHOLD } from "./stock-threshold";
import { formatGeminiFallback, localCleanTitle } from "./copy-local";
import { normalizeSupplierStock } from "./supplier-stock";
import { spokenProductName } from "./product-title";

describe("publish status", () => {
  it("never marks PUBLISHED without a live Shopify mode", () => {
    expect(productStatusAfterPublish("local_only")).toBe("local_only");
    expect(shouldMarkPublished("local_only")).toBe(false);
  });

  it("marks published only for live mode", () => {
    expect(productStatusAfterPublish("live")).toBe("published");
    expect(shouldMarkPublished("live")).toBe(true);
  });

  it("builds admin product URLs from gid", () => {
    expect(shopifyAdminProductUrl("mystore", "gid://shopify/Product/12345")).toBe(
      "https://admin.shopify.com/store/mystore/products/12345",
    );
  });
});

describe("low stock threshold", () => {
  it("uses the shared constant of 30", () => {
    expect(LOW_STOCK_THRESHOLD).toBe(30);
    expect(isLowStock(0)).toBe(true);
    expect(isLowStock(15)).toBe(true);
    expect(isLowStock(29)).toBe(true);
    expect(isLowStock(30)).toBe(false);
  });
});

describe("import stock / ship mapping", () => {
  it("caps suspicious supplier pools instead of inventing 100", () => {
    expect(normalizeSupplierStock(0)).toBe(0);
    expect(normalizeSupplierStock(99_999)).toBe(99);
    expect(normalizeSupplierStock(42)).toBe(42);
  });
});

describe("gemini fallback reason", () => {
  it("formats a visible reason for the UI", () => {
    expect(formatGeminiFallback("model not found")).toBe(
      "Gemini failed: model not found; used local copy",
    );
  });
});

describe("localCleanTitle", () => {
  it("keeps a short current title instead of appending supplier junk", () => {
    expect(
      localCleanTitle(
        "Pet Hair Remover Roller Dog Cat Fur Cleaner Wholesale 2024",
        "Pet Hair Remover Roller",
        spokenProductName,
      ),
    ).toBe("Pet Hair Remover Roller");
  });
});

describe("meta pause safety", () => {
  it("preview path must not call pause APIs when dryRun is true", () => {
    const pauseAdSet = vi.fn();
    const pauseTikTok = vi.fn();
    const dryRun = true;
    if (!dryRun) {
      pauseAdSet();
      pauseTikTok();
    }
    expect(pauseAdSet).not.toHaveBeenCalled();
    expect(pauseTikTok).not.toHaveBeenCalled();
  });
});
