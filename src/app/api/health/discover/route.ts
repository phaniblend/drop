import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { evaluateDiscoverHealth } from "@/lib/aliexpress-search-html";

function authorized(req: NextRequest) {
  if (!env.cronSecret) return process.env.NODE_ENV !== "production";
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return bearer === env.cronSecret;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchAliExpress } = await import("@/lib/integrations/aliexpress");
  const queries = ["neck fan", "posture brace", "phone stand"];
  const results = [];
  for (const query of queries) {
    const items = await searchAliExpress(query);
    const health = evaluateDiscoverHealth(
      query,
      items.map((item) => ({ title: item.title, cost: item.cost })),
    );
    results.push({
      query,
      ...health,
      sample: items.slice(0, 3).map((item) => ({
        title: item.title,
        cost: item.cost,
      })),
    });
  }

  return NextResponse.json({
    ok: results.every((row) => row.ok),
    results,
  });
}
