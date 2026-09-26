"use client";

import { useEffect } from "react";
import { clearStoreCart } from "@/lib/store-cart";

export function StoreThanksClear({ paid }: { paid: boolean }) {
  useEffect(() => {
    if (paid) clearStoreCart();
  }, [paid]);
  return null;
}
