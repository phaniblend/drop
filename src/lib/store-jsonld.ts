import { deliveryWindow } from "./delivery";
import type { PublicStoreProduct } from "./shopper-copy";

export function storeProductJsonLd(product: PublicStoreProduct) {
  const ship = deliveryWindow(product.shippingDays);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    image: product.imageUrl ? [product.imageUrl] : undefined,
    offers: {
      "@type": "Offer",
      price: product.price.toFixed(2),
      priceCurrency: "USD",
      availability: product.variants.some((v) => v.stock > 0)
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      shippingDetails: {
        "@type": "OfferShippingDetails",
        deliveryTime: {
          "@type": "ShippingDeliveryTime",
          handlingTime: { "@type": "QuantitativeValue", minValue: 1, maxValue: 1, unitCode: "DAY" },
          transitTime: {
            "@type": "QuantitativeValue",
            minValue: ship.low,
            maxValue: ship.high,
            unitCode: "DAY",
          },
        },
      },
    },
  };
}
