export const ORDER_QUERY = `
query Order($id: ID!) {
  order(id: $id) {
    id name test createdAt processedAt cancelledAt updatedAt displayFinancialStatus
    paymentGatewayNames sourceName
    currentSubtotalPriceSet { shopMoney { amount currencyCode } }
    totalDiscountsSet { shopMoney { amount } }
    totalShippingPriceSet { shopMoney { amount } }
    totalTaxSet { shopMoney { amount } }
    totalPriceSet { shopMoney { amount } }
    totalRefundedSet { shopMoney { amount } }
    customer { id }
    customerJourneySummary {
      firstVisit { landingPage referrerUrl utmParameters { source medium campaign term content } }
      lastVisit  { landingPage referrerUrl utmParameters { source medium campaign term content } }
    }
    lineItems(first: 100) { nodes { id quantity currentQuantity sku
      variant { id product { id } }
      originalUnitPriceSet { shopMoney { amount } }
      totalDiscountSet { shopMoney { amount } } } }
    refunds { id createdAt totalRefundedSet { shopMoney { amount } }
      refundLineItems(first: 100) { nodes { quantity lineItem { id } restockType } } }
  }
}
`;

export type ShopifyMoneySet = { shopMoney?: { amount?: string; currencyCode?: string } };
export type ShopifyUtm = { source?: string; medium?: string; campaign?: string; term?: string; content?: string };
export type ShopifyVisit = { landingPage?: string; referrerUrl?: string; utmParameters?: ShopifyUtm };

export type ShopifyOrderNode = {
  id: string;
  name?: string;
  test?: boolean;
  createdAt?: string;
  processedAt?: string;
  cancelledAt?: string | null;
  updatedAt?: string;
  displayFinancialStatus?: string;
  paymentGatewayNames?: string[];
  sourceName?: string | null;
  currentSubtotalPriceSet?: ShopifyMoneySet;
  totalDiscountsSet?: ShopifyMoneySet;
  totalShippingPriceSet?: ShopifyMoneySet;
  totalTaxSet?: ShopifyMoneySet;
  totalPriceSet?: ShopifyMoneySet;
  totalRefundedSet?: ShopifyMoneySet;
  customer?: { id?: string } | null;
  customerJourneySummary?: { firstVisit?: ShopifyVisit | null; lastVisit?: ShopifyVisit | null } | null;
  lineItems?: {
    nodes?: Array<{
      id: string;
      quantity?: number;
      currentQuantity?: number;
      sku?: string | null;
      variant?: { id?: string; product?: { id?: string } } | null;
      originalUnitPriceSet?: ShopifyMoneySet;
      totalDiscountSet?: ShopifyMoneySet;
    }>;
  };
  refunds?: Array<{
    id: string;
    createdAt?: string;
    totalRefundedSet?: ShopifyMoneySet;
    refundLineItems?: { nodes?: Array<{ quantity?: number; lineItem?: { id?: string }; restockType?: string }> };
  }>;
};

export function moneyAmount(set?: ShopifyMoneySet | null) {
  const n = Number(set?.shopMoney?.amount ?? 0);
  return Number.isFinite(n) ? n : 0;
}
