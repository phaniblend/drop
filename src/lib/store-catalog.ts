import type { PublicStoreProduct } from "./shopper-copy";

export function storeCartCatalog(products: PublicStoreProduct[]) {
  return products.flatMap((product) =>
    product.variants.map((variant) => ({
      productId: product.id,
      variantId: variant.id,
      title: `${product.title} · ${variant.name}`,
      imageUrl: product.imageUrl,
      qty: 1,
      unitPrice: variant.price,
      stock: variant.stock,
    })),
  );
}
