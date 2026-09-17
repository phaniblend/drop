import { NextRequest, NextResponse } from "next/server";
import { applyStripeSubscription, cancelStripeSubscription } from "@/lib/billing";
import { verifyStripeSignature } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifyStripeSignature(raw, req.headers.get("stripe-signature"))) {
    return NextResponse.json({ error: "Invalid Stripe signature" }, { status: 400 });
  }

  const event = JSON.parse(raw) as {
    type?: string;
    data?: {
      object?: {
        metadata?: { userId?: string; plan?: string };
        customer?: string;
        subscription?: string;
        id?: string;
      };
    };
  };

  if (event.type === "checkout.session.completed") {
    const session = event.data?.object;
    const userId = session?.metadata?.userId;
    const customerId = session?.customer;
    const subscriptionId = session?.subscription;
    if (userId && customerId && subscriptionId) {
      await applyStripeSubscription({
        userId,
        customerId,
        subscriptionId,
        tier: session?.metadata?.plan === "scaler" ? "scaler" : "starter",
      });
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subId = event.data?.object?.id;
    if (subId) await cancelStripeSubscription(subId);
  }

  return NextResponse.json({ received: true });
}
