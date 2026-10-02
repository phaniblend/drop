import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { buildMetaAuthorizeUrl, metaAppReady } from "@/lib/integrations/meta-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!metaAppReady()) {
    return NextResponse.redirect(new URL("/settings?meta=missing_app#meta", req.nextUrl));
  }
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(buildMetaAuthorizeUrl(state));
  res.cookies.set("meta_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return res;
}
