import { NextRequest, NextResponse } from "next/server";
import { getOperator } from "@/lib/db/queries";
import { env } from "@/lib/env";
import { appOrigin, stripePost } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  let plan: "starter" | "scaler" = "starter";
  try {
    const body = (await req.json()) as { plan?: string };
    if (body.plan === "scaler") plan = "scaler";
  } catch {
    /* default starter */
  }

  const priceId = plan === "scaler" ? env.stripePriceScaler : env.stripePriceStarter;
  if (!env.stripeSecretKey || !priceId) {
    return NextResponse.json(
      {
        error: "Upgrade checkout is not connected yet. Ask whoever set up the store to connect billing.",
      },
      { status: 503 },
    );
  }

  const user = await getOperator();
  if (!user) {
    return NextResponse.json({ error: "No operator profile." }, { status: 404 });
  }

  const origin = appOrigin();
  try {
    const session = await stripePost<{ url?: string }>("checkout/sessions", {
      mode: "subscription",
      "payment_method_types[0]": "card",
      customer_email: user.email,
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      success_url: `${origin}/catalog?upgraded=true`,
      cancel_url: `${origin}/discover?canceled=true`,
      "metadata[userId]": user.id,
      "metadata[plan]": plan,
      "subscription_data[metadata][userId]": user.id,
      "subscription_data[metadata][plan]": plan,
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Stripe checkout failed." },
      { status: 502 },
    );
  }
}
