import Link from "next/link";
import { BrandLogo } from "./brand-logo";
import { StoreCartLink } from "./store-cart-link";

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
    <div className="min-h-dvh bg-bg text-ink">
      {metaPixelId ? (
        <script
          dangerouslySetInnerHTML={{
            __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${metaPixelId.replace(/[^0-9]/g, "")}');fbq('track','PageView');`,
          }}
        />
      ) : null}
      <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link href={homeHref} prefetch={false} className="min-w-0">
            <BrandLogo wordmark={storeName} />
          </Link>
          <StoreCartLink storeId={storeId} homeHref={homeHref} cartHref={`${homeHref.replace(/\/$/, "")}/cart`} />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
