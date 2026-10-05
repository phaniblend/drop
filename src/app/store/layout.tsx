import type { Metadata } from "next";
import { StoreShell } from "@/components/store-shell";
import { StoreFooter } from "@/components/store-footer";
import { StripeKeysPrompt } from "@/components/stripe-keys-form";
import { getStorefrontBrand } from "@/lib/storefront";
import { storeHomePath } from "@/lib/store-slug";
import { maskStripeKey } from "@/lib/stripe-keys";
import { getOperator } from "@/lib/db/queries";

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
  const operator = await getOperator();
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
      {operator ? (
        <StripeKeysPrompt
          live={brand.stripeMode === "live"}
          autoOpen
          publishableMasked={maskStripeKey(operator.storeStripePk)}
          secretMasked={maskStripeKey(operator.storeStripeSk)}
          mode={brand.stripeMode}
        />
      ) : null}
      {children}
      <StoreFooter storeName={brand.name} homeHref={homeHref} stripeMode={brand.stripeMode} />
    </StoreShell>
  );
}
