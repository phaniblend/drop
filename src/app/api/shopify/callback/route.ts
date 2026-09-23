import { auth } from "@/auth";
import { NextResponse } from "next/server";
import {
  exchangeShopifyOAuthCode,
  saveShopifyOAuthConnection,
  verifyShopifyOAuthHmac,
} from "@/lib/shopify-oauth";
import { invalidateDeskShell } from "@/lib/desk-shell";

function settingsRedirect(req: Request, ok: boolean, error?: string) {
  const url = new URL("/settings", req.url);
  if (ok) {
    url.searchParams.set("shopify", "connected");
  } else {
    url.searchParams.set("shopify", "error");
    if (error) url.searchParams.set("shopify_error", error.slice(0, 200));
  }
  return url;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const query = url.searchParams;

  if (query.get("error")) {
    const res = NextResponse.redirect(
      settingsRedirect(req, false, query.get("error_description") || query.get("error") || "Shopify denied access."),
    );
    res.cookies.delete("shopify_oauth_state");
    return res;
  }

  if (!verifyShopifyOAuthHmac(query)) {
    const res = NextResponse.redirect(settingsRedirect(req, false, "Shopify HMAC check failed."));
    res.cookies.delete("shopify_oauth_state");
    return res;
  }

  const code = query.get("code");
  const shop = query.get("shop");
  const state = query.get("state");
  if (!code || !shop || !state) {
    const res = NextResponse.redirect(settingsRedirect(req, false, "Missing code, shop, or state."));
    res.cookies.delete("shopify_oauth_state");
    return res;
  }

  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.match(/(?:^|;\s*)shopify_oauth_state=([^;]+)/);
  const cookieVal = match ? decodeURIComponent(match[1]!) : "";
  const [expectedState, expectedShop] = cookieVal.split(".");
  if (!expectedState || expectedState !== state) {
    const res = NextResponse.redirect(settingsRedirect(req, false, "OAuth state mismatch — try Connect again."));
    res.cookies.delete("shopify_oauth_state");
    return res;
  }

  const session = await auth();
  if (!session?.user) {
    const login = new URL("/login", req.url);
    login.searchParams.set("callbackUrl", "/settings");
    const res = NextResponse.redirect(login);
    res.cookies.delete("shopify_oauth_state");
    return res;
  }

  try {
    const exchanged = await exchangeShopifyOAuthCode(shop, code);
    if (expectedShop && exchanged.domain !== expectedShop) {
      throw new Error("Shop domain did not match the Connect request.");
    }
    await saveShopifyOAuthConnection({
      domain: exchanged.domain,
      accessToken: exchanged.accessToken,
    });
    invalidateDeskShell();
    const res = NextResponse.redirect(settingsRedirect(req, true));
    res.cookies.delete("shopify_oauth_state");
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Token exchange failed.";
    const res = NextResponse.redirect(settingsRedirect(req, false, msg));
    res.cookies.delete("shopify_oauth_state");
    return res;
  }
}
