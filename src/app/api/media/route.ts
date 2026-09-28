import { NextRequest, NextResponse } from "next/server";
import { isSupplierCdn } from "@/lib/image-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("u") ?? "";
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return new NextResponse("Bad image URL", { status: 400 });
  }
  if (!isSupplierCdn(url.href)) {
    return new NextResponse("Unsupported image host", { status: 400 });
  }

  const upstream = await fetch(url.href, {
    headers: { Referer: "https://www.aliexpress.com/", Accept: "image/*" },
    signal: AbortSignal.timeout(12_000),
    cache: "force-cache",
  });
  if (!upstream.ok) {
    return new NextResponse("Image unavailable", { status: 502 });
  }

  const type = upstream.headers.get("content-type") || "image/jpeg";
  if (!type.startsWith("image/")) {
    return new NextResponse("Not an image", { status: 502 });
  }

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": type,
      "Cache-Control": "public, max-age=604800, immutable",
    },
  });
}
