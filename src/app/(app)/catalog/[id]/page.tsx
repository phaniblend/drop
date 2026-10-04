import { notFound } from "next/navigation";
import { getOperator, getProduct } from "@/lib/db/queries";
import { ProductEditor } from "@/components/product-editor";
import { shopifyStorefrontHomeUrl } from "@/lib/shopify-storefront";
import { storeHomePath } from "@/lib/store-slug";
import { stripeKeyMode } from "@/lib/stripe-keys";
import { sellerPublishGaps, sellerPublishHint } from "@/lib/storefront";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) notFound();
  const [storefrontHomeUrl, operator] = await Promise.all([shopifyStorefrontHomeUrl(), getOperator()]);
  const sellerMissing = sellerPublishGaps(operator);
  const sellerReady = sellerMissing.length === 0;
  return (
    <ProductEditor
      product={product}
      storefrontHomeUrl={storefrontHomeUrl}
      storeHref={storeHomePath(operator?.storeSlug)}
      stripeLive={stripeKeyMode(operator?.storeStripeSk) === "live"}
      sellerReady={sellerReady}
      sellerHint={sellerPublishHint(sellerMissing)}
    />
  );
}
