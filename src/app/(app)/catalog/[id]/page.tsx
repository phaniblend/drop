import { notFound } from "next/navigation";
import { getProduct } from "@/lib/db/queries";
import { ProductEditor } from "@/components/product-editor";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) notFound();
  return <ProductEditor product={product} />;
}
