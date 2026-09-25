import Link from "next/link";
import { BrandLogo } from "./brand-logo";
import { StoreCartLink } from "./store-cart-link";

export function StoreShell({
  storeName,
  children,
}: {
  storeName: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-bg text-ink">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/store" className="min-w-0">
            <BrandLogo />
            <p className="truncate text-xs text-muted">{storeName}</p>
          </Link>
          <StoreCartLink />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
