import { NextRequest, NextResponse } from "next/server";
import { searchLiveSuppliers } from "@/lib/discover-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 20;

export async function POST(req: NextRequest) {
  let query = "";
  let niche = "all";
  try {
    const body = (await req.json()) as { query?: string; niche?: string };
    query = String(body.query ?? "");
    niche = String(body.niche ?? "all");
  } catch {
    return NextResponse.json(
      { mode: "live", items: [], error: "Search request was invalid.", sources: [] },
      { status: 400 },
    );
  }

  try {
    const result = await searchLiveSuppliers(query, niche);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({
      mode: "live",
      items: [],
      sources: [],
      error: error instanceof Error ? error.message : "Search failed. Try again.",
    });
  }
}
