import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { PlanCheckoutButtons } from "@/components/plan-checkout-buttons";
import { auth } from "@/auth";

export const metadata = {
  title: "Pricing — SetoStore",
  description: "Plans for dropshippers who want product discovery, a store, and Margin Guard.",
};

const PLANS = [
  {
    id: "trial",
    name: "Free trial",
    price: "$0",
    blurb: "Explore the desk before you pay.",
    points: [
      "5 product imports (lifetime trial)",
      "Built-in store preview",
      "Sample Ads & Guard walkthrough (clearly marked)",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    price: "$19/mo",
    blurb: "For operators running one store and ads.",
    points: [
      "30 product imports / month",
      "Margin Guard on up to 5 ad sets",
      "Your own Stripe checkout",
    ],
  },
  {
    id: "scaler",
    name: "Scaler",
    price: "$39/mo",
    blurb: "For higher volume and more campaigns watched.",
    points: [
      "120 product imports / month",
      "Unlimited Margin Guard campaigns",
      "Priority when new supplier tools ship",
    ],
  },
];

export default async function PricingPage() {
  const session = await auth();
  const signedIn = Boolean(session?.user?.email);

  return (
    <main className="min-h-dvh bg-bg text-ink">
      <header className="border-b border-line px-4 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/">
            <BrandLogo />
          </Link>
          {signedIn ? (
            <Link href="/" className="text-sm text-accent">
              Open desk
            </Link>
          ) : (
            <Link href="/login" className="text-sm text-accent">
              Sign in
            </Link>
          )}
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Simple plans</h1>
        <p className="mt-2 max-w-xl text-sm text-muted">
          You own Stripe, Meta, and TikTok. Seto helps you find products, sell, and pause losing ads.
          Lens / visual match is not sold until it is live on your desk.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {PLANS.map((plan) => (
            <section key={plan.name} className="rounded-2xl border border-line bg-surface p-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">{plan.name}</p>
              <p className="mt-2 text-3xl font-semibold">{plan.price}</p>
              <p className="mt-2 text-sm text-muted">{plan.blurb}</p>
              <ul className="mt-4 space-y-2 text-sm text-muted">
                {plan.points.map((p) => (
                  <li key={p}>· {p}</li>
                ))}
              </ul>
              {plan.id === "starter" || plan.id === "scaler" ? (
                <div className="mt-5">
                  <PlanCheckoutButtons signedIn={signedIn} compact plans={[plan.id]} />
                </div>
              ) : signedIn ? (
                <p className="mt-5 text-xs text-faint">You are on this plan until you subscribe.</p>
              ) : (
                <Link href="/login?next=/pricing" className="mt-5 inline-block text-sm text-accent">
                  Sign in to start the trial
                </Link>
              )}
            </section>
          ))}
        </div>
        <p className="mt-8 text-sm text-muted">
          Questions? Email{" "}
          <a className="text-accent" href="mailto:support@seto.store">
            support@seto.store
          </a>
          .
        </p>
      </div>
    </main>
  );
}
