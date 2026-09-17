import { NextRequest, NextResponse } from "next/server";
import { runAllGuards } from "@/app/actions/campaigns";
import { env } from "@/lib/env";

export const runtime = "nodejs";

function cronAuthorized(req: NextRequest) {
  if (!env.cronSecret) return true;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const query = req.nextUrl.searchParams.get("secret");
  return bearer === env.cronSecret || query === env.cronSecret;
}

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { daypart, results } = await runAllGuards();
  return NextResponse.json({
    ok: true,
    job: "hourly",
    daypart,
    checked: results.length,
    killed: results.filter((r) => r.actionTaken !== "MAINTAINED").length,
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
