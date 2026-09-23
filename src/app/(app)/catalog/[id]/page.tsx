import { notFound } from "next/navigation";
import { getProduct } from "@/lib/db/queries";
import { ProductEditor } from "@/components/product-editor";
import { shopifyStorefrontHomeUrl } from "@/lib/shopify-storefront";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) notFound();
  const storefrontHomeUrl = await shopifyStorefrontHomeUrl();
  return <ProductEditor product={product} storefrontHomeUrl={storefrontHomeUrl} />;
}
