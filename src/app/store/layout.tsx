import type { Metadata } from "next";
import { StoreShell } from "@/components/store-shell";
import { StoreFooter } from "@/components/store-footer";
import { getStorefrontBrand } from "@/lib/storefront";
import { storeHomePath } from "@/lib/store-slug";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getStorefrontBrand();
  return {
    title: brand.name,
    description: `${brand.name} — tracked shipping, pay by card.`,
  };
}

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const brand = await getStorefrontBrand();
  const homeHref = storeHomePath(brand.slug);
  return (
    <StoreShell
      storeName={brand.name}
      storeId={brand.userId}
      homeHref={homeHref}
      metaPixelId={brand.metaPixelId}
    >
      {brand.stripeMode !== "live" ? (
        <div className="border-b border-warn/40 bg-warn/10 px-4 py-2 text-center text-xs text-warn">
          Preview only — card checkout is not live until live Stripe keys are connected in Settings.
        </div>
      ) : null}
      {children}
      <StoreFooter storeName={brand.name} homeHref={homeHref} stripeMode={brand.stripeMode} />
    </StoreShell>
  );
}
