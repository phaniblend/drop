import { StoreCartDesk } from "@/components/store-cart-desk";
import { listLiveStoreProducts } from "@/lib/storefront";

export default async function StoreCartPage({
  searchParams,
}: {
  searchParams: Promise<{ canceled?: string }>;
}) {
  const { canceled } = await searchParams;
  const products = await listLiveStoreProducts();
  const catalog = products.flatMap((product) =>
    product.variants.map((variant) => ({
      productId: product.id,
      variantId: variant.id,
      title: `${product.title} · ${variant.name}`,
      qty: 1,
      unitPrice: variant.price,
      stock: variant.stock,
    })),
  );
  return <StoreCartDesk catalog={catalog} canceled={canceled === "1"} />;
}
