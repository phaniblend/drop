import { NextRequest, NextResponse } from "next/server";
import { ensureDb } from "@/lib/db";
import { logActivity } from "@/lib/db/seed";
import { publishLiveProduct } from "@/lib/storefront";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let productId = "";
  let allowUnknownShipping = false;
  let allowRestricted = false;
  try {
    const body = (await req.json()) as {
      productId?: string;
      allowUnknownShipping?: boolean;
      allowRestricted?: boolean;
    };
    productId = String(body.productId ?? "").trim();
    allowUnknownShipping = Boolean(body.allowUnknownShipping);
    allowRestricted = Boolean(body.allowRestricted);
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!productId) {
    return NextResponse.json({ error: "Missing product." }, { status: 400 });
  }

  try {
    const result = await publishLiveProduct(productId, { allowUnknownShipping, allowRestricted });
    const db = await ensureDb();
    await logActivity(db, {
      kind: "publish",
      message: `Published ${result.title} to your Seto Storefront`,
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
