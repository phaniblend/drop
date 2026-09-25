import { NextRequest, NextResponse } from "next/server";
import { nid } from "@/lib/utils";
import { env } from "@/lib/env";
import { appOrigin, stripePost } from "@/lib/stripe";
import { resolveStoreLines, savePendingStoreCart } from "@/lib/store-orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!env.stripeSecretKey) {
    return NextResponse.json(
      { error: "Checkout is not connected yet. Ask whoever hosts this desk to turn on Stripe." },
      { status: 503 },
    );
  }

  let body: { lines?: Array<{ productId: string; variantId: string; qty: number }> };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid cart." }, { status: 400 });
  }

  const lines = await resolveStoreLines(body.lines ?? []);
  if (!lines.length) {
    return NextResponse.json({ error: "Your cart is empty or those items are no longer for sale." }, { status: 400 });
  }

  const cartId = nid("cart");
  await savePendingStoreCart(cartId, lines);
  const origin = appOrigin();

  const payload: Record<string, string> = {
    mode: "payment",
    "payment_method_types[0]": "card",
    success_url: `${origin}/store/thanks?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/store/cart`,
    "shipping_address_collection[allowed_countries][0]": "US",
    "metadata[kind]": "store_order",
    "metadata[cartId]": cartId,
  };

  lines.forEach((line, index) => {
    payload[`line_items[${index}][quantity]`] = String(line.qty);
    payload[`line_items[${index}][price_data][currency]`] = "usd";
    payload[`line_items[${index}][price_data][unit_amount]`] = String(Math.round(line.unitPrice * 100));
    payload[`line_items[${index}][price_data][product_data][name]`] = line.title.slice(0, 120);
  });

  try {
    const session = await stripePost<{ url?: string }>("checkout/sessions", payload);
    if (!session.url) {
      return NextResponse.json({ error: "Stripe did not return a checkout link." }, { status: 502 });
    }
    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Checkout failed. Try again." },
      { status: 502 },
    );
  }
}
