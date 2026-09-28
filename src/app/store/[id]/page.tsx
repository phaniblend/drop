import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { StoreBuyBox } from "@/components/store-buy-box";
import { StoreProductMedia } from "@/components/store-product-media";
import { getLiveStoreProduct, storeProductUrl } from "@/lib/storefront";
import { getUserById } from "@/lib/db/queries";
import { deliveryWindow } from "@/lib/delivery";
import { storeHomePath } from "@/lib/store-slug";
import { money } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await getLiveStoreProduct(id);
  if (!product) return { title: "Not found" };
  return {
    title: product.title,
    description: `${product.title} — ${deliveryWindow(product.shippingDays).text}.`,
    alternates: { canonical: storeProductUrl(product.id) },
    openGraph: {
      title: product.title,
      images: product.imageUrl ? [{ url: product.imageUrl }] : undefined,
    },
  };
}

export default async function StoreProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getLiveStoreProduct(id);
  if (!product) notFound();
  if (product.userId) {
    const owner = await getUserById(product.userId);
    const home = storeHomePath(owner?.storeSlug);
    if (home.startsWith("/s/")) {
      redirect(`${home}/${id}`);
    }
  }
  const ship = deliveryWindow(product.shippingDays);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    image: product.imageUrl ? [product.imageUrl] : undefined,
    offers: {
      "@type": "Offer",
      price: product.price.toFixed(2),
      priceCurrency: "USD",
      availability: product.variants.some((v) => v.stock > 0)
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      shippingDetails: {
        "@type": "OfferShippingDetails",
        deliveryTime: {
          "@type": "ShippingDeliveryTime",
          handlingTime: { "@type": "QuantitativeValue", minValue: 1, maxValue: 1, unitCode: "DAY" },
          transitTime: {
            "@type": "QuantitativeValue",
            minValue: ship.low,
            maxValue: ship.high,
            unitCode: "DAY",
          },
        },
      },
    },
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <StoreProductMedia title={product.title} imageUrl={product.imageUrl} variants={product.variants} />
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
        <StoreBuyBox productId={product.id} variants={product.variants} />
      </div>
    </div>
  );
}
