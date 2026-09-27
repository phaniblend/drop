import { NextRequest, NextResponse } from "next/server";
import { listSavedFeedProducts, toggleSavedListing } from "@/lib/saved-listings";
import { asFeedProduct, savedListingKey } from "@/lib/saved-listing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await listSavedFeedProducts();
    return NextResponse.json({ items, keys: items.map(savedListingKey) });
  } catch {
    return NextResponse.json({ items: [], keys: [] });
  }
}

export async function POST(req: NextRequest) {
  let item;
  try {
    const body = (await req.json()) as { item?: unknown };
    item = asFeedProduct(body.item);
  } catch {
    return NextResponse.json({ error: "Invalid listing." }, { status: 400 });
  }
  if (!item) return NextResponse.json({ error: "Missing listing." }, { status: 400 });
  try {
    const result = await toggleSavedListing(item);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save listing." },
      { status: 400 },
    );
  }
}
