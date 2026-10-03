import { StoreTermsCopy } from "@/components/store-policies";
import { getStorefrontBrand } from "@/lib/storefront";

export default async function StoreTermsPage() {
  const brand = await getStorefrontBrand();
  return (
    <StoreTermsCopy
      storeName={brand.name}
      email={brand.supportEmail}
      address={brand.businessAddress}
    />
  );
}
