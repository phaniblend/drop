"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addStoreCartLine } from "@/lib/store-cart";
import { money } from "@/lib/utils";
import { Button } from "./ui";

function shopperStockLabel(stock: number) {
  if (stock <= 0) return "Sold out";
  if (stock <= 8) return "Low stock";
  return "In stock";
}

export function StoreBuyBox({
  productId,
  variants,
  storeId = "",
  cartHref = "/store/cart",
}: {
  productId: string;
  variants: Array<{ id: string; name: string; stock: number; price?: number; imageUrl?: string | null }>;
  storeId?: string;
  cartHref?: string;
}) {
  const router = useRouter();
  const [variantId, setVariantId] = useState(variants[0]?.id ?? "default");
  const [adding, setAdding] = useState(false);
  const selected = variants.find((variant) => variant.id === variantId) ?? variants[0];
  const soldOut = !selected || selected.stock <= 0;
  const showOptions = variants.length > 1;
  const prices = variants.map((v) => v.price).filter((p): p is number => typeof p === "number" && p > 0);
  const showVariantPrice = prices.length > 1 && Math.max(...prices) - Math.min(...prices) > 0.01;

  return (
    <div className="space-y-3">
      {showOptions ? (
        <label className="block text-sm">
          <span className="text-xs uppercase tracking-wider text-faint">Option</span>
          <select
            className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2"
            value={variantId}
            onChange={(e) => setVariantId(e.target.value)}
          >
            {variants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.name}
                {showVariantPrice && variant.price ? ` — ${money(variant.price)}` : ""}
                {variant.stock <= 0 ? " — sold out" : ""}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {showVariantPrice && selected?.price ? (
        <p className="text-lg font-medium">{money(selected.price)}</p>
      ) : null}
      <p className="text-xs text-muted">{selected ? shopperStockLabel(selected.stock) : "Sold out"}</p>
      <Button
        tone="accent"
        className="w-full"
        disabled={soldOut || adding}
        onClick={() => {
          addStoreCartLine({ productId, variantId, qty: 1 }, storeId);
          setAdding(true);
          router.push(`${cartHref}?added=1`);
        }}
      >
        {soldOut ? "Sold out" : adding ? "Added to bag…" : "Add to bag"}
      </Button>
    </div>
  );
}
