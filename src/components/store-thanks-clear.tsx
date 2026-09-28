"use client";

import { useEffect } from "react";
import { clearStoreCart } from "@/lib/store-cart";

export function StoreThanksClear({ paid, storeId = "" }: { paid: boolean; storeId?: string }) {
  useEffect(() => {
    if (paid) clearStoreCart(storeId);
  }, [paid, storeId]);
  return null;
}
