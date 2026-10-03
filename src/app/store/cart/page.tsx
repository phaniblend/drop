import { StoreCartDesk } from "@/components/store-cart-desk";
import { storeCartCatalog } from "@/lib/store-catalog";
import { getStorefrontBrand, listLiveStoreProducts } from "@/lib/storefront";
import { storeHomePath } from "@/lib/store-slug";

export default async function StoreCartPage({
  searchParams,
}: {
  searchParams: Promise<{ canceled?: string; added?: string }>;
}) {
  const { canceled, added } = await searchParams;
  const brand = await getStorefrontBrand();
  const products = await listLiveStoreProducts(brand.userId || undefined);
  return (
    <StoreCartDesk
      catalog={storeCartCatalog(products)}
      storeId={brand.userId}
      homeHref={storeHomePath(brand.slug)}
      canceled={canceled === "1"}
      added={added === "1"}
      checkoutEnabled={brand.stripeMode === "live"}
      checkoutBlockedReason={
        brand.stripeMode === "test"
          ? "This store is still in Stripe test mode. Live keys are required before shoppers can pay."
          : "Checkout is offline until the store connects live Stripe keys in Settings."
      }
    />
  );
}
