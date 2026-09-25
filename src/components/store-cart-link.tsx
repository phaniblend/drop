"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cartCount, readStoreCart } from "@/lib/store-cart";

export function StoreCartLink() {
  const [count, setCount] = useState(0);

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
    <Link href="/store/cart" className="rounded-xl border border-line bg-surface px-3 py-2 text-sm">
      Bag{count ? ` · ${count}` : ""}
    </Link>
  );
}
