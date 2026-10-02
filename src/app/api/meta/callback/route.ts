import { NextRequest, NextResponse } from "next/server";
import { exchangeMetaOAuthCode, saveMetaConnectionFromToken } from "@/lib/integrations/meta-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error_description") || req.nextUrl.searchParams.get("error");
  const cookieState = req.cookies.get("meta_oauth_state")?.value;
  const clear = NextResponse.redirect(new URL("/settings?meta=connected#meta", req.nextUrl));

  if (error) {
    const fail = NextResponse.redirect(
      new URL(`/settings?meta=error&meta_error=${encodeURIComponent(error)}#meta`, req.nextUrl),
    );
    fail.cookies.delete("meta_oauth_state");
    return fail;
  }
  if (!code || !state || !cookieState || state !== cookieState) {
    const fail = NextResponse.redirect(new URL("/settings?meta=error&meta_error=state#meta", req.nextUrl));
    fail.cookies.delete("meta_oauth_state");
    return fail;
  }

  try {
    const short = await exchangeMetaOAuthCode(code);
    await saveMetaConnectionFromToken(short);
    clear.cookies.delete("meta_oauth_state");
    return clear;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Meta connect failed";
    const fail = NextResponse.redirect(
      new URL(`/settings?meta=error&meta_error=${encodeURIComponent(msg.slice(0, 180))}#meta`, req.nextUrl),
    );
    fail.cookies.delete("meta_oauth_state");
    return fail;
  }
}
