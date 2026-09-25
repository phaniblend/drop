import { StoreShell } from "@/components/store-shell";
import { getStorefrontBrand } from "@/lib/storefront";

export const dynamic = "force-dynamic";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const brand = await getStorefrontBrand();
  return <StoreShell storeName={brand.name}>{children}</StoreShell>;
}
