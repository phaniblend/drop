import { StorePrivacyCopy } from "@/components/store-policies";
import { getStorefrontBrand } from "@/lib/storefront";

export default async function StorePrivacyPage() {
  const brand = await getStorefrontBrand();
  return (
    <StorePrivacyCopy
      email={brand.supportEmail}
      storeName={brand.name}
      hasPixel={Boolean(brand.metaPixelId)}
    />
  );
}
