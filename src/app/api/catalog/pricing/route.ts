import { NextRequest, NextResponse } from "next/server";
import { writeProductPricing } from "@/lib/db/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: {
    productId?: string;
    retailPrice?: number;
    markupMultiplier?: number;
    shippingCost?: number;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const productId = String(body.productId ?? "").trim();
  if (!productId) {
    return NextResponse.json({ error: "Missing product." }, { status: 400 });
  }

  try {
    const result = await writeProductPricing(productId, {
      retailPrice: Number(body.retailPrice),
      markupMultiplier: Number(body.markupMultiplier),
      shippingCost: Number(body.shippingCost),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save pricing." },
      { status: 500 },
    );
  }
}
