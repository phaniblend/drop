"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addStoreCartLine } from "@/lib/store-cart";
import { Button } from "./ui";

export function StoreBuyBox({
  productId,
  variants,
}: {
  productId: string;
  variants: Array<{ id: string; name: string; stock: number }>;
}) {
  const router = useRouter();
  const [variantId, setVariantId] = useState(variants[0]?.id ?? "default");
  const [adding, setAdding] = useState(false);
  const selected = variants.find((variant) => variant.id === variantId) ?? variants[0];
  const soldOut = !selected || selected.stock <= 0;

  return (
    <div className="space-y-3">
      {variants.length ? (
        <label className="block text-sm">
          <span className="text-xs uppercase tracking-wider text-faint">Option</span>
          <select
            className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2"
            value={variantId}
            onChange={(e) => setVariantId(e.target.value)}
            disabled={variants.length === 1}
          >
            {variants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.name}
                {variant.stock <= 0 ? " (sold out)" : ""}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <Button
        tone="accent"
        className="w-full"
        disabled={soldOut || adding}
        onClick={() => {
          addStoreCartLine({ productId, variantId, qty: 1 });
          setAdding(true);
          router.push("/store/cart?added=1");
        }}
      >
        {soldOut ? "Sold out" : adding ? "Added to bag…" : "Add to bag"}
      </Button>
    </div>
  );
}
