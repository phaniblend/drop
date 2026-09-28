import { NextRequest, NextResponse } from "next/server";
import { applyStripeSubscription, cancelStripeSubscription } from "@/lib/billing";
import { fulfillStoreCheckout } from "@/lib/store-orders";
import { verifyStripeSignature } from "@/lib/stripe";
import { planFromStripeMetadata } from "@/lib/stripe-billing";

type StripeObject = {
  id?: string;
  object?: string;
  status?: string;
  customer?: string;
  subscription?: string;
  metadata?: { userId?: string; plan?: string; kind?: string };
};

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifyStripeSignature(raw, req.headers.get("stripe-signature"))) {
    return NextResponse.json({ error: "Invalid Stripe signature" }, { status: 400 });
  }

  const event = JSON.parse(raw) as { type?: string; data?: { object?: StripeObject } };
  const obj = event.data?.object;

  if (event.type === "checkout.session.completed" && obj?.metadata?.kind === "store_order") {
    if (obj.id) {
      try {
        await fulfillStoreCheckout(obj.id);
      } catch {
        /* thanks page retries if webhook is first */
      }
    }
    return NextResponse.json({ received: true });
  }

  if (event.type === "checkout.session.completed") {
    const userId = obj?.metadata?.userId;
    const customerId = typeof obj?.customer === "string" ? obj.customer : undefined;
    const subscriptionId = typeof obj?.subscription === "string" ? obj.subscription : undefined;
    if (userId && customerId && subscriptionId) {
      await applyStripeSubscription({
        userId,
        customerId,
        subscriptionId,
        tier: planFromStripeMetadata(obj.metadata?.plan),
        status: "active",
      });
    }
    return NextResponse.json({ received: true });
  }

  if (
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.created" ||
    event.type === "invoice.paid" ||
    event.type === "invoice.payment_failed"
  ) {
    const subscriptionId =
      obj?.object === "subscription" ? obj.id : typeof obj?.subscription === "string" ? obj.subscription : undefined;
    const status =
      event.type === "invoice.payment_failed"
        ? "past_due"
        : event.type === "invoice.paid"
          ? "active"
          : obj?.status;
    await applyStripeSubscription({
      userId: obj?.metadata?.userId,
      customerId: typeof obj?.customer === "string" ? obj.customer : undefined,
      subscriptionId,
      tier: planFromStripeMetadata(obj?.metadata?.plan),
      status,
    });
  }

  if (event.type === "customer.subscription.deleted") {
    const subId = obj?.id;
    if (subId) await cancelStripeSubscription(subId);
  }

  return NextResponse.json({ received: true });
}
