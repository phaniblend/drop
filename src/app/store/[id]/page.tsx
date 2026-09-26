import { notFound } from "next/navigation";
import { Thumb } from "@/components/thumb";
import { StoreBuyBox } from "@/components/store-buy-box";
import { getLiveStoreProduct } from "@/lib/storefront";
import { money } from "@/lib/utils";

export default async function StoreProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getLiveStoreProduct(id);
  if (!product) notFound();

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <Thumb src={product.imageUrl} alt="" className="h-80 w-full rounded-2xl" />
      <div className="space-y-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">For sale</p>
        <h1 className="text-3xl font-semibold">{product.title}</h1>
        <p className="text-xl font-medium">{money(product.price)}</p>
        <p className="text-sm text-muted">{product.shippingDays} day typical delivery</p>
        <div
          className="prose-sm text-sm text-muted [&_li]:ml-4 [&_li]:list-disc"
          dangerouslySetInnerHTML={{ __html: product.descriptionHtml }}
        />
        <StoreBuyBox productId={product.id} variants={product.variants} />
      </div>
    </div>
  );
}
