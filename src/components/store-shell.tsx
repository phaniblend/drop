import Link from "next/link";
import { BrandLogo } from "./brand-logo";
import { StoreCartLink } from "./store-cart-link";
import { StoreCookieNotice } from "./store-cookie-notice";
import { StorePixel } from "./store-pixel";

export function StoreShell({
  storeName,
  storeId = "",
  homeHref = "/store",
  metaPixelId = "",
  children,
}: {
  storeName: string;
  storeId?: string;
  homeHref?: string;
  metaPixelId?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh overflow-x-hidden bg-bg text-ink">
      {metaPixelId ? <StorePixel metaPixelId={metaPixelId} /> : null}
      <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link href={homeHref} prefetch={false} className="min-w-0">
            <BrandLogo wordmark={storeName} />
          </Link>
          <StoreCartLink storeId={storeId} homeHref={homeHref} cartHref={`${homeHref.replace(/\/$/, "")}/cart`} />
        </div>
      </header>
      <main className="mx-auto max-w-5xl overflow-x-hidden px-4 py-8">{children}</main>
      <StoreCookieNotice hasPixel={Boolean(metaPixelId)} />
    </div>
  );
}
