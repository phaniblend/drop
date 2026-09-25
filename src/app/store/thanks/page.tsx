import Link from "next/link";
import { fulfillStoreCheckout } from "@/lib/store-orders";

export default async function StoreThanksPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;
  let saved = false;
  if (sessionId) {
    try {
      saved = Boolean(await fulfillStoreCheckout(sessionId));
    } catch {
      saved = false;
    }
  }

  return (
    <div className="space-y-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">Paid</p>
      <h1 className="text-3xl font-semibold">You are on the list</h1>
      <p className="max-w-lg text-sm text-muted">
        {saved
          ? "Payment landed. We will buy this from the supplier and send tracking when it ships."
          : "If your card went through, the order will show on the desk in a moment. Keep this tab for your records."}
      </p>
      <Link href="/store" className="inline-block text-sm text-accent">
        Back to the store
      </Link>
    </div>
  );
}