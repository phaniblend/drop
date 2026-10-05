import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getOperator } from "@/lib/db/queries";
import { ensureDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { appOrigin, stripePost } from "@/lib/stripe";

async function ensureCustomer(user: { id: string; email: string; displayName: string; stripeCustomerId: string | null }) {
  if (user.stripeCustomerId) return user.stripeCustomerId;
  const customer = await stripePost<{ id: string }>("customers", {
    email: user.email,
    name: user.displayName,
    "metadata[userId]": user.id,
    "metadata[kind]": "membership",
  });
  const db = await ensureDb();
  await db.update(users).set({ stripeCustomerId: customer.id }).where(eq(users.id, user.id));
  return customer.id;
}

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
        error: "Seto membership checkout is not connected yet. Add live Stripe prices on the host.",
      },
      { status: 503 },
    );
  }

  const user = await getOperator();
  if (!user) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const origin = appOrigin();
  try {
    const customer = await ensureCustomer(user);
    const session = await stripePost<{ url?: string }>("checkout/sessions", {
      mode: "subscription",
      "payment_method_types[0]": "card",
      customer,
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      success_url: `${origin}/settings?upgraded=${plan}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/settings?canceled=true`,
      client_reference_id: user.id,
      allow_promotion_codes: "true",
      "metadata[userId]": user.id,
      "metadata[plan]": plan,
      "metadata[kind]": "membership",
      "subscription_data[metadata][userId]": user.id,
      "subscription_data[metadata][plan]": plan,
      "subscription_data[metadata][kind]": "membership",
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Stripe checkout failed." },
      { status: 502 },
    );
  }
}
