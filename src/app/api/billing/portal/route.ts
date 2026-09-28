import { NextResponse } from "next/server";
import { getOperator } from "@/lib/db/queries";
import { env } from "@/lib/env";
import { appOrigin, stripePost } from "@/lib/stripe";

export async function POST() {
  if (!env.stripeSecretKey) {
    return NextResponse.json({ error: "Billing is not connected yet." }, { status: 503 });
  }
  const user = await getOperator();
  if (!user?.stripeCustomerId) {
    return NextResponse.json({ error: "No paid plan to manage yet." }, { status: 404 });
  }
  try {
    const session = await stripePost<{ url?: string }>("billing_portal/sessions", {
      customer: user.stripeCustomerId,
      return_url: `${appOrigin()}/settings`,
    });
    if (!session.url) {
      return NextResponse.json({ error: "Stripe did not return a portal link." }, { status: 502 });
    }
    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not open billing portal." },
      { status: 502 },
    );
  }
}
