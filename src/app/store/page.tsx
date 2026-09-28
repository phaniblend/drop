import Link from "next/link";
import { Thumb } from "@/components/thumb";
import { getStorefrontBrand, listLiveStoreProducts } from "@/lib/storefront";
import { storeHomePath } from "@/lib/store-slug";
import { money } from "@/lib/utils";

export default async function StoreHomePage() {
  const brand = await getStorefrontBrand();
  const products = await listLiveStoreProducts(brand.userId || undefined);

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">Store</p>
        <h1 className="mt-1 text-3xl font-semibold">{brand.name}</h1>
        <p className="mt-2 max-w-xl text-sm text-muted">Ships with tracking. Pay by card.</p>
      </div>
      {products.length === 0 ? (
        <p className="text-sm text-muted">Nothing for sale yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <Link
              key={product.id}
              href={storeHomePath(brand.slug) === "/store" ? `/store/${product.id}` : `${storeHomePath(brand.slug)}/${product.id}`}
              className="overflow-hidden rounded-2xl border border-line bg-surface"
            >
              <Thumb src={product.imageUrl} alt={product.title} className="h-52 w-full rounded-none" />
              <div className="space-y-1 p-4">
                <p className="text-sm font-semibold">{product.title}</p>
                <p className="font-mono text-sm">{money(product.price)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
