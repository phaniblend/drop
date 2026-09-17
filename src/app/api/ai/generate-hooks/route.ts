import { NextRequest, NextResponse } from "next/server";
import { generateAdHooks } from "@/lib/ad-hooks";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { title?: string; description?: string; benefits?: string; price?: number };
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

  return NextResponse.json({ ok: true, ...result });
}
