import { NextRequest, NextResponse } from "next/server";
import { runAllGuards } from "@/app/actions/campaigns";
import { env } from "@/lib/env";

function cronAuthorized(req: NextRequest) {
  if (!env.cronSecret) return true;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const query = req.nextUrl.searchParams.get("secret");
  return bearer === env.cronSecret || query === env.cronSecret;
}

async function run(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { daypart, results } = await runAllGuards();
  return NextResponse.json({
    ok: true,
    checked: results.length,
    killed: results.filter((r) => r.actionTaken !== "MAINTAINED").length,
    daypart,
    results,
  });
}

export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}
