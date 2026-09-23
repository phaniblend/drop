/** Shared low-stock floor for Suppliers, Command triage, checklist, and Guard copy. */
export const LOW_STOCK_THRESHOLD = 30;

export function isLowStock(stock: number, threshold = LOW_STOCK_THRESHOLD) {
  return Number.isFinite(stock) && stock >= 0 && stock < threshold;
}
