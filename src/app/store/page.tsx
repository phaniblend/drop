import Link from "next/link";
import { Thumb } from "@/components/thumb";
import { getStorefrontBrand, listLiveStoreProducts } from "@/lib/storefront";
import { money } from "@/lib/utils";

export default async function StoreHomePage() {
  const [brand, products] = await Promise.all([getStorefrontBrand(), listLiveStoreProducts()]);

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">Store</p>
        <h1 className="mt-1 text-3xl font-semibold">{brand.name}</h1>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Ships from our suppliers. Card checkout is Stripe. No extra store subscription.
        </p>
      </div>
      {products.length === 0 ? (
        <p className="text-sm text-muted">Nothing for sale yet. Publish a product from the desk and it shows up here.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => {
            const price = product.variants[0]?.variantPrice || product.retailPrice;
            return (
              <Link
                key={product.id}
                href={`/store/${product.id}`}
                className="overflow-hidden rounded-2xl border border-line bg-surface"
              >
                <Thumb src={product.imageUrl} alt="" className="h-52 w-full rounded-none" />
                <div className="space-y-1 p-4">
                  <p className="text-sm font-semibold">{product.cleanTitle ?? product.rawTitle}</p>
                  <p className="font-mono text-sm">{money(price)}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
