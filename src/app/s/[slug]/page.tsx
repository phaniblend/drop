import Link from "next/link";
import { notFound } from "next/navigation";
import { Thumb } from "@/components/thumb";
import { getUserBySlug } from "@/lib/db/queries";
import { listLiveStoreProducts } from "@/lib/storefront";
import { money } from "@/lib/utils";

export default async function SlugStoreHomePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getUserBySlug(slug);
  if (!user) notFound();
  const products = await listLiveStoreProducts(user.id);

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">Store</p>
        <h1 className="mt-1 text-3xl font-semibold">{user.storeName}</h1>
        <p className="mt-2 max-w-xl text-sm text-muted">Ships with tracking. Pay by card.</p>
      </div>
      {products.length === 0 ? (
        <p className="text-sm text-muted">Nothing for sale yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <Link
              key={product.id}
              href={`/s/${slug}/${product.id}`}
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
