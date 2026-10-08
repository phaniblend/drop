import { NextRequest, NextResponse } from "next/server";
import { exchangeMetaOAuthCode, saveMetaConnectionFromToken } from "@/lib/integrations/meta-oauth";
import { appOrigin } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function settingsRedirect(pathWithQuery: string) {
  return NextResponse.redirect(new URL(pathWithQuery, appOrigin()));
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error_description") || req.nextUrl.searchParams.get("error");
  const cookieState = req.cookies.get("meta_oauth_state")?.value;
  const clear = settingsRedirect("/settings?meta=connected#meta");

  if (error) {
    const fail = settingsRedirect(
      `/settings?meta=error&meta_error=${encodeURIComponent(error)}#meta`,
    );
    fail.cookies.delete("meta_oauth_state");
    return fail;
  }
  if (!code || !state || !cookieState || state !== cookieState) {
    const fail = settingsRedirect("/settings?meta=error&meta_error=state#meta");
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
    const fail = settingsRedirect(
      `/settings?meta=error&meta_error=${encodeURIComponent(msg.slice(0, 180))}#meta`,
    );
    fail.cookies.delete("meta_oauth_state");
    return fail;
  }
}
