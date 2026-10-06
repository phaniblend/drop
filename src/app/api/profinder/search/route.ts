import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canOpenProfinder } from "@/lib/profinder-allow";
import { searchProfinderLeads } from "@/lib/profinder-search";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST() {
  const session = await auth();
  if (!canOpenProfinder(session?.user?.email)) {
    return NextResponse.json({ error: "Not available." }, { status: 404 });
  }
  try {
    const result = await searchProfinderLeads();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { leads: [], warning: error instanceof Error ? error.message : "Search failed." },
      { status: 502 },
    );
  }
}
