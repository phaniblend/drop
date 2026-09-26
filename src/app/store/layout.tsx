import type { Metadata } from "next";
import { StoreShell } from "@/components/store-shell";
import { StoreFooter } from "@/components/store-footer";
import { getStorefrontBrand } from "@/lib/storefront";
import { stripeCheckoutMode } from "@/lib/stripe-mode";
import { env } from "@/lib/env";

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
  return (
    <StoreShell storeName={brand.name}>
      {children}
      <StoreFooter storeName={brand.name} stripeMode={stripeCheckoutMode(env.stripeSecretKey)} />
    </StoreShell>
  );
}
