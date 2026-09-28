import { StoreCartDesk } from "@/components/store-cart-desk";
import { getUserBySlug } from "@/lib/db/queries";
import { storeCartCatalog } from "@/lib/store-catalog";
import { listLiveStoreProducts } from "@/lib/storefront";
import { storeHomePath } from "@/lib/store-slug";
import { notFound } from "next/navigation";

export default async function SlugStoreCartPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ canceled?: string; added?: string }>;
}) {
  const { slug } = await params;
  const { canceled, added } = await searchParams;
  const user = await getUserBySlug(slug);
  if (!user) notFound();
  const products = await listLiveStoreProducts(user.id);
  return (
    <StoreCartDesk
      catalog={storeCartCatalog(products)}
      storeId={user.id}
      homeHref={storeHomePath(user.storeSlug)}
      canceled={canceled === "1"}
      added={added === "1"}
    />
  );
}
