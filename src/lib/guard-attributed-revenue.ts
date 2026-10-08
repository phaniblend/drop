import { isPracticeOrder } from "./practice-order";
import { todayKey } from "./utils";

/**
 * Desk revenue attributed to a product for Margin Guard.
 * PRACTICE-* / practice_ shopify ids are always excluded.
 */
export function guardAttributedRevenue(input: {
  storedRevenueToday: number;
  productId: string | null | undefined;
  orders: Array<{
    totalRevenue: number;
    createdAt: string;
    orderNumber?: string | null;
    shopifyOrderId?: string | null;
    customerEmail?: string | null;
    items: Array<{ productId?: string | null }>;
  }>;
  timeZone?: string;
}) {
  const tz = input.timeZone || "America/Chicago";
  const today = todayKey(tz);
  const desk = input.productId
    ? input.orders
        .filter((o) => !isPracticeOrder(o) && todayKey(tz, o.createdAt) === today)
        .filter((o) => o.items.some((item) => item.productId === input.productId))
        .reduce((sum, o) => sum + o.totalRevenue, 0)
    : 0;
  // Prefer the larger of stored ad-platform revenue and real desk sales (never practice).
  return Math.max(input.storedRevenueToday, desk);
}
