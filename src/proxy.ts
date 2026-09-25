import { auth } from "@/auth";
import { NextResponse } from "next/server";

function googleConfigured() {
  const id = (process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID || "").trim();
  const secret = (process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET || "").trim();
  return id.length > 12 && secret.length > 12;
}

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  const loggedIn = Boolean(req.auth);
  const publicPath =
    pathname === "/login" ||
    pathname.startsWith("/store") ||
    pathname.startsWith("/api/store") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/cron") ||
    pathname.startsWith("/api/webhooks") ||
    pathname.startsWith("/api/shopify/callback");

  if (publicPath) {
    if (loggedIn && pathname === "/login") {
      return NextResponse.redirect(new URL("/", req.nextUrl));
    }
    return NextResponse.next();
  }

  if (!googleConfigured()) return NextResponse.next();

  if (!loggedIn) {
    const url = new URL("/login", req.nextUrl);
    if (pathname !== "/") url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|api/health|store|api/store|.*\\.(?:svg|png|jpg|jpeg|gif|webp|webmanifest)$).*)",
  ],
};
