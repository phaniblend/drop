import Link from "next/link";

export default function PlatformTermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 text-sm text-muted">
      <h1 className="text-2xl font-semibold text-ink">SetoStore terms</h1>
      <p className="mt-3">
        SetoStore is software for finding products, running a shop, and watching ad spend. You pay your
        own Stripe fees and your own ads. You are responsible for what you list and how you advertise it.
      </p>
      <p className="mt-3">
        Do not list supplements, weapons, adult goods, or anything Stripe or the ad networks prohibit.
      </p>
      <p className="mt-3">The free trial has product limits. Paid plans are billed through Stripe.</p>
      <p className="mt-6">
        <Link href="/privacy" className="text-accent">
          Privacy
        </Link>
      </p>
    </main>
  );
}
