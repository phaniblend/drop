import { auth } from "@/auth";
import { NextResponse } from "next/server";
import {
  buildShopifyAuthorizeUrl,
  createShopifyOAuthState,
  normalizeShopDomain,
  shopifyAppCredentialsReady,
} from "@/lib/shopify-oauth";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    const login = new URL("/login", req.url);
    login.searchParams.set("callbackUrl", "/settings");
    return NextResponse.redirect(login);
  }

  if (!shopifyAppCredentialsReady()) {
    return NextResponse.redirect(
      new URL("/settings?shopify=error&shopify_error=" + encodeURIComponent("Shopify app Client ID/Secret missing on Railway."), req.url),
    );
  }

  const shopRaw = new URL(req.url).searchParams.get("shop")?.trim() || "";
  if (!shopRaw) {
    return NextResponse.redirect(
      new URL("/settings?shopify=error&shopify_error=" + encodeURIComponent("Enter your shop name (e.g. my-store)."), req.url),
    );
  }

  let shop: string;
  try {
    shop = normalizeShopDomain(shopRaw);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid shop name.";
    return NextResponse.redirect(
      new URL("/settings?shopify=error&shopify_error=" + encodeURIComponent(msg), req.url),
    );
  }

  const state = createShopifyOAuthState();
  const authorize = buildShopifyAuthorizeUrl(shop, state);
  const res = NextResponse.redirect(authorize);
  res.cookies.set("shopify_oauth_state", `${state}.${shop}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return res;
}
