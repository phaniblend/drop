import { NextRequest, NextResponse } from "next/server";
import { nid } from "@/lib/utils";
import { appOrigin, stripePost } from "@/lib/stripe";
import { resolveStoreLines, savePendingStoreCart, StoreCheckoutError } from "@/lib/store-orders";
import { rememberCheckoutMerchant, resolveMerchantStripeSecret } from "@/lib/merchant-stripe";
import { getUserById } from "@/lib/db/queries";
import { storefrontPath } from "@/lib/store-slug";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { lines?: Array<{ productId: string; variantId: string; qty: number }> };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid cart." }, { status: 400 });
  }

  let lines;
  try {
    lines = await resolveStoreLines(body.lines ?? []);
  } catch (error) {
    if (error instanceof StoreCheckoutError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
  if (!lines.length) {
    return NextResponse.json({ error: "Your cart is empty or those items are no longer for sale." }, { status: 400 });
  }

  const secret = await resolveMerchantStripeSecret(lines[0]?.merchantId);
  if (!secret) {
    return NextResponse.json(
      { error: "Checkout is disabled until this store connects its own Stripe keys in Settings. Seto will not take the payment." },
      { status: 503 },
    );
  }

  const cartId = nid("cart");
  await savePendingStoreCart(cartId, lines);
  const origin = appOrigin();

  const merchant = lines[0]?.merchantId ? await getUserById(lines[0].merchantId) : null;
  const statement = (merchant?.storeName || "SetoStore").replace(/[^a-zA-Z0-9 ]/g, "").slice(0, 22);
  const payload: Record<string, string> = {
    mode: "payment",
    "payment_method_types[0]": "card",
    success_url: `${origin}${storefrontPath(merchant?.storeSlug, "thanks")}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}${storefrontPath(merchant?.storeSlug, "cart")}?canceled=1`,
    "shipping_address_collection[allowed_countries][0]": "US",
    "billing_address_collection": "auto",
    "name_collection[individual][enabled]": "true",
    "metadata[kind]": "store_order",
    "metadata[cartId]": cartId,
  };
  if (statement.length >= 5) {
    payload["payment_intent_data[statement_descriptor]"] = statement;
    payload["payment_intent_data[description]"] = `${merchant?.storeName || "SetoStore"} order`;
  }

  lines.forEach((line, index) => {
    payload[`line_items[${index}][quantity]`] = String(line.qty);
    payload[`line_items[${index}][price_data][currency]`] = "usd";
    payload[`line_items[${index}][price_data][unit_amount]`] = String(Math.round(line.unitPrice * 100));
    payload[`line_items[${index}][price_data][product_data][name]`] = line.title.slice(0, 120);
  });

  try {
    const session = await stripePost<{ url?: string; id?: string }>("checkout/sessions", payload, secret);
    if (!session.url) {
      return NextResponse.json({ error: "Stripe did not return a checkout link." }, { status: 502 });
    }
    if (session.id && lines[0]?.merchantId) {
      await rememberCheckoutMerchant(session.id, lines[0].merchantId);
    }
    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Checkout failed. Try again." },
      { status: 502 },
    );
  }
}
