import { NextRequest, NextResponse } from "next/server";
import { runAllGuards } from "@/app/actions/campaigns";
import { env } from "@/lib/env";

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (env.cronSecret && secret !== env.cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const results = await runAllGuards();
  return NextResponse.json({
    ok: true,
    checked: results.length,
    killed: results.filter((r) => r.actionTaken === "KILLED_CAMPAIGN").length,
    results,
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
