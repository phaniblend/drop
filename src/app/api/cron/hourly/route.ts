import { NextRequest, NextResponse } from "next/server";
import { runAllGuards } from "@/app/actions/campaigns";
import { env } from "@/lib/env";
import { ensureDb } from "@/lib/db";
import { reconcileAllActiveShops } from "@/lib/shopify/reconcile";

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
  const db = await ensureDb();
  const reconcile = await reconcileAllActiveShops(db);

  let metaSync: Awaited<ReturnType<typeof import("@/lib/margin-guard-v2/meta-sync").runMetaSyncJobs>> = [];
  try {
    const { runMetaSyncJobs } = await import("@/lib/margin-guard-v2/meta-sync");
    metaSync = await runMetaSyncJobs(db);
  } catch (e) {
    metaSync = [
      {
        adAccountId: "—",
        entities: 0,
        insights: 0,
        error: e instanceof Error ? e.message : "meta sync failed",
      },
    ];
  }

  let dual: Awaited<
    ReturnType<typeof import("@/lib/margin-guard-v2/run-evaluate").evaluateAllActiveAdSets>
  > = [];
  try {
    const { evaluateAllActiveAdSets } = await import("@/lib/margin-guard-v2/run-evaluate");
    dual = await evaluateAllActiveAdSets();
  } catch (e) {
    dual = [
      {
        adsetId: "—",
        verdict: "ERROR",
        paused: false,
        error: e instanceof Error ? e.message : "dual evaluate failed",
      },
    ];
  }

  const { daypart, results } = await runAllGuards();
  return NextResponse.json({
    ok: true,
    job: "hourly",
    reconcile,
    metaSync,
    dualSignal: {
      checked: dual.length,
      paused: dual.filter((r) => r.paused).length,
      results: dual.slice(0, 40),
    },
    daypart,
    checked: results.length,
    killed: results.filter((r) => r.actionTaken !== "MAINTAINED").length,
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
