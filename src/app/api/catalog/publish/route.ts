import { NextRequest, NextResponse } from "next/server";
import { ensureDb } from "@/lib/db";
import { logActivity } from "@/lib/db/seed";
import { publishLiveProduct } from "@/lib/storefront";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let productId = "";
  try {
    const body = (await req.json()) as { productId?: string };
    productId = String(body.productId ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!productId) {
    return NextResponse.json({ error: "Missing product." }, { status: 400 });
  }

  try {
    const result = await publishLiveProduct(productId);
    const db = await ensureDb();
    await logActivity(db, {
      kind: "publish",
      message: result.firstShop
        ? `${result.title} opened your shop and is live.`
        : `${result.title} is live on your Seto store.`,
      href: `/store/${result.handle}`,
    });
    return NextResponse.json({
      ...result,
      updated: !result.firstShop,
      status: "published",
      storefrontUrl: result.storeUrl,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not publish." },
      { status: 500 },
    );
  }
}
