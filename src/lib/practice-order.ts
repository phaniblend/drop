/** Practice smoke-test orders — never count in revenue / Guard. */
export function isPracticeOrder(order: {
  orderNumber?: string | null;
  shopifyOrderId?: string | null;
  customerEmail?: string | null;
}) {
  const number = (order.orderNumber ?? "").toUpperCase();
  const shopify = (order.shopifyOrderId ?? "").toLowerCase();
  const email = (order.customerEmail ?? "").toLowerCase();
  return (
    number.startsWith("PRACTICE-") ||
    shopify.startsWith("practice_") ||
    email === "practice@seto.store"
  );
}

/** Sum revenue for Margin Guard / KPIs — practice orders contribute 0. */
export function realOrderRevenue(
  orders: Array<{
    totalRevenue: number;
    orderNumber?: string | null;
    shopifyOrderId?: string | null;
    customerEmail?: string | null;
  }>,
) {
  return orders.reduce((sum, order) => (isPracticeOrder(order) ? sum : sum + order.totalRevenue), 0);
}
