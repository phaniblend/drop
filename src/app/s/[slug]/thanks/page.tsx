import Link from "next/link";
import { notFound } from "next/navigation";
import { fulfillStoreCheckout } from "@/lib/store-orders";
import { StoreThanksClear } from "@/components/store-thanks-clear";
import { getUserBySlug } from "@/lib/db/queries";
import { money } from "@/lib/utils";
import { deliveryWindow } from "@/lib/delivery";
import { storeHomePath } from "@/lib/store-slug";

export default async function SlugStoreThanksPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { slug } = await params;
  const user = await getUserBySlug(slug);
  if (!user) notFound();
  const { session_id: sessionId } = await searchParams;
  let receipt = null;
  if (sessionId) {
    try {
      receipt = await fulfillStoreCheckout(sessionId);
    } catch {
      receipt = null;
    }
  }
  const window = deliveryWindow();
  const homeHref = storeHomePath(user.storeSlug);

  return (
    <div className="space-y-5">
      <StoreThanksClear paid={Boolean(receipt)} storeId={user.id} />
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">Order Confirmed</p>
      <h1 className="text-3xl font-semibold">Order Confirmed</h1>
      {receipt ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-line bg-surface px-5 py-4">
            <p className="text-xs uppercase tracking-wider text-faint">Order ID</p>
            <p className="mt-1 font-mono text-2xl font-semibold tracking-wide">{receipt.orderNumber}</p>
            <p className="mt-3 text-sm text-muted">
              We buy this from the supplier within 1 business day. Typical arrival{" "}
              <strong className="font-medium text-ink">{window.short}</strong> after that
              ({receipt.deliveryText.toLowerCase()}).
            </p>
          </div>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {receipt.items.map((item) => (
              <li key={`${item.title}-${item.qty}`} className="flex items-center justify-between gap-3 px-5 py-3">
                <p className="min-w-0 text-sm">
                  {item.qty}× {item.title}
                </p>
                <p className="shrink-0 font-mono text-sm">{money(item.unitPrice * item.qty)}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="max-w-lg text-sm text-muted">
          If your card went through, the order will show on the desk in a moment. Keep this tab for your
          records — we will email tracking when it ships.
        </p>
      )}
      <Link href={homeHref} prefetch={false} className="inline-block text-sm text-accent">
        Back to the store
      </Link>
    </div>
  );
}
