import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureDb } from "@/lib/db";
import { undoGuardPause } from "@/lib/margin-guard-v2/undo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { token?: string; actionId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const session = await auth();
  const actor = session?.user?.email || (body.token ? "email-link" : "");
  if (!body.token && !session?.user?.email) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  if (!body.token && !body.actionId) {
    return NextResponse.json({ error: "Provide token or actionId." }, { status: 400 });
  }

  const db = await ensureDb();
  const result = await undoGuardPause(
    { token: body.token, actionId: body.actionId, actor: actor || "unknown" },
    { db },
  );
  if (!result.ok) {
    return NextResponse.json(result, { status: result.state === "EXTERNALLY_CHANGED" ? 409 : 400 });
  }
  return NextResponse.json(result);
}
