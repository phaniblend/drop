import { NextRequest, NextResponse } from "next/server";
import { applyStripeSubscription, cancelStripeSubscription } from "@/lib/billing";
import { fulfillStoreCheckout } from "@/lib/store-orders";
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
        metadata?: { userId?: string; plan?: string; kind?: string };
        customer?: string;
        subscription?: string;
        id?: string;
      };
    };
  };

  if (event.type === "checkout.session.completed" && event.data?.object?.metadata?.kind === "store_order") {
    const sessionId = event.data.object.id;
    if (sessionId) {
      try {
        await fulfillStoreCheckout(sessionId);
      } catch {
        /* thanks page retries if webhook is first */
      }
    }
    return NextResponse.json({ received: true });
  }

  if (event.type === "checkout.session.completed" || event.type === "customer.subscription.updated") {
    const session = event.data?.object;
    const userId = session?.metadata?.userId;
    const customerId = typeof session?.customer === "string" ? session.customer : undefined;
    const subscriptionId =
      typeof session?.subscription === "string" ? session.subscription : session?.id;
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
