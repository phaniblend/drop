import { NextRequest, NextResponse } from "next/server";
import { searchCompetitorAds } from "@/lib/integrations/meta-ad-library";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("query")?.trim() ?? "";
  const result = await searchCompetitorAds(query);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result);
}
