import { StoreCartDesk } from "@/components/store-cart-desk";
import { listLiveStoreProducts } from "@/lib/storefront";
import { humanizeVariantLabel } from "@/lib/variant-label";

export default async function StoreCartPage() {
  const products = await listLiveStoreProducts();
  const catalog = products.flatMap((product) => {
    const variants = product.variants.length
      ? product.variants
      : [{ id: "default", variantName: "Default", variantPrice: product.retailPrice }];
    return variants.map((variant) => ({
      productId: product.id,
      variantId: variant.id,
      title: `${product.cleanTitle ?? product.rawTitle} · ${humanizeVariantLabel(variant.variantName)}`,
      qty: 1,
      unitPrice: variant.variantPrice || product.retailPrice,
    }));
  });
  return <StoreCartDesk catalog={catalog} />;
}
