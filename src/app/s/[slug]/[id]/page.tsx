import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StoreBuyBox } from "@/components/store-buy-box";
import { StoreProductMedia } from "@/components/store-product-media";
import { getLiveStoreProduct, storeProductUrl } from "@/lib/storefront";
import { getUserBySlug } from "@/lib/db/queries";
import { deliveryWindow } from "@/lib/delivery";
import { storeProductJsonLd } from "@/lib/store-jsonld";
import { storefrontPath } from "@/lib/store-slug";
import { money } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}): Promise<Metadata> {
  const { slug, id } = await params;
  const product = await getLiveStoreProduct(id);
  if (!product) return { title: "Not found" };
  return {
    title: product.title,
    description: `${product.title} — ${deliveryWindow(product.shippingDays).text}.`,
    alternates: { canonical: storeProductUrl(product.id, slug) },
    openGraph: {
      title: product.title,
      images: product.imageUrl ? [{ url: product.imageUrl }] : undefined,
    },
  };
}

export default async function SlugProductPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const user = await getUserBySlug(slug);
  if (!user) notFound();
  const product = await getLiveStoreProduct(id);
  if (!product || product.userId !== user.id) notFound();
  const ship = deliveryWindow(product.shippingDays);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(storeProductJsonLd(product)) }} />
      <StoreProductMedia title={product.title} imageUrl={product.imageUrl} variants={product.variants} priority />
      <div className="space-y-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">For sale</p>
        <h1 className="text-2xl font-semibold sm:text-3xl">{product.title}</h1>
        <p className="text-xl font-medium">{money(product.price)}</p>
        <p className="text-sm text-muted">{ship.text}</p>
        <p className="text-xs text-muted">30-day refund or replacement if it arrives wrong or damaged.</p>
        <div
          className="prose-sm text-sm text-muted [&_li]:ml-4 [&_li]:list-disc"
          dangerouslySetInnerHTML={{ __html: product.descriptionHtml }}
        />
        <StoreBuyBox
          productId={product.id}
          variants={product.variants}
          storeId={user.id}
          cartHref={storefrontPath(user.storeSlug, "cart")}
        />
      </div>
    </div>
  );
}
