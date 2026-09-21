import { NextRequest, NextResponse } from "next/server";
import { integrationStatus } from "@/lib/env";
import { searchFeed } from "@/lib/supplier-feed";

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
      { mode: "live", items: [], error: "Search request was invalid." },
      { status: 400 },
    );
  }

  const canSearch = query.trim().length >= 2 || niche !== "all";
  if (integrationStatus().aliexpress && canSearch) {
    try {
      const { searchAliExpress } = await import("@/lib/integrations/aliexpress");
      const items = await searchAliExpress(query.trim(), niche);
      return NextResponse.json({
        mode: "live",
        items,
        error:
          items.length === 0
            ? niche !== "all" && query.trim()
              ? `No ${niche} listings matched that name. Try All, or a more specific product.`
              : "No live listings matched that name. Try two or three simple words."
            : undefined,
      });
    } catch (error) {
      return NextResponse.json({
        mode: "live",
        items: [],
        error: error instanceof Error ? error.message : "Search failed. Try again.",
      });
    }
  }

  return NextResponse.json({ mode: "demo", items: canSearch ? searchFeed(query, niche) : [] });
}
