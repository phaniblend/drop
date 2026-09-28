import { StoreContactCopy } from "@/components/store-policies";
import { getStorefrontBrand } from "@/lib/storefront";

export default async function StoreContactPage() {
  const brand = await getStorefrontBrand();
  return (
    <StoreContactCopy
      storeName={brand.name}
      email={brand.supportEmail}
      address={brand.businessAddress}
    />
  );
}
