/** AliExpress often dumps a shared ~99k pool onto every SKU. Cap so stock stays decision-useful. */
export function normalizeSupplierStock(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  const n = Math.round(raw);
  // Order-volume / shared-pool lookalikes — never show as real inventory.
  if (n >= 10_000) return 99;
  if (n >= 5_000) return 150;
  if (n >= 1_000) return Math.min(400, n);
  return n;
}

/** If every variant shares the same inflated pool number, collapse to one capped value each. */
export function normalizeVariantStocks<T extends { stock: number }>(variants: T[]): T[] {
  if (variants.length === 0) return variants;
  const stocks = variants.map((v) => v.stock);
  const allSuspicious = stocks.every((s) => s >= 500);
  const samePool =
    stocks.length > 1 &&
    Math.max(...stocks) - Math.min(...stocks) <= Math.max(30, Math.max(...stocks) * 0.02);

  if (allSuspicious && samePool) {
    const capped = normalizeSupplierStock(stocks[0] ?? 0);
    return variants.map((v) => ({ ...v, stock: capped }));
  }

  return variants.map((v) => ({ ...v, stock: normalizeSupplierStock(v.stock) }));
}
