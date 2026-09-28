"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cartCount, readStoreCart } from "@/lib/store-cart";

export function StoreCartLink({ homeHref = "/store" }: { homeHref?: string }) {
  const pathname = usePathname();
  const [count, setCount] = useState(0);
  const onBag = pathname === "/store/cart" || pathname.endsWith("/cart");

  useEffect(() => {
    const sync = () => setCount(cartCount(readStoreCart()));
    sync();
    window.addEventListener("seto-cart", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("seto-cart", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return (
    <Link
      href={onBag ? homeHref : "/store/cart"}
      aria-current={onBag ? "page" : undefined}
      aria-label={onBag ? "Back to the store" : "Open bag"}
      className="rounded-xl border border-line bg-surface px-3 py-2 text-sm hover:border-line-strong"
    >
      {onBag ? `Shop${count ? ` · ${count} in bag` : ""}` : `Bag${count ? ` · ${count}` : ""}`}
    </Link>
  );
}
