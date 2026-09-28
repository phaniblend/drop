import { notFound } from "next/navigation";
import { getOperator, getProduct } from "@/lib/db/queries";
import { ProductEditor } from "@/components/product-editor";
import { shopifyStorefrontHomeUrl } from "@/lib/shopify-storefront";
import { storeHomePath } from "@/lib/store-slug";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) notFound();
  const [storefrontHomeUrl, operator] = await Promise.all([shopifyStorefrontHomeUrl(), getOperator()]);
  return (
    <ProductEditor
      product={product}
      storefrontHomeUrl={storefrontHomeUrl}
      storeHref={storeHomePath(operator?.storeSlug)}
    />
  );
}
