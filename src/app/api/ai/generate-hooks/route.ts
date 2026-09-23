import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { generateAdHooks } from "@/lib/ad-hooks";
import { ensureDb } from "@/lib/db";
import { products } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: {
    title?: string;
    description?: string;
    benefits?: string;
    price?: number;
    productId?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON body required." }, { status: 400 });
  }

  const title = body.title?.trim() ?? "";
  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const result = await generateAdHooks({
    title,
    description: body.description?.trim() ?? "",
    benefits: body.benefits?.trim() ?? "",
    price: Number(body.price) || 0,
  });

  const productId = body.productId?.trim();
  if (productId && result.hooks.length) {
    try {
      const db = await ensureDb();
      const [row] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
      if (row) {
        await db
          .update(products)
          .set({
            adAnglesPrevJson: row.adAnglesJson || "[]",
            adAnglesJson: JSON.stringify(result.hooks),
          })
          .where(eq(products.id, productId));
      }
    } catch (e) {
      console.error("[generate-hooks] persist failed", e);
    }
  }

  return NextResponse.json({ ok: true, ...result });
}
