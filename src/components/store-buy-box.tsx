"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addStoreCartLine } from "@/lib/store-cart";
import { humanizeVariantLabel } from "@/lib/variant-label";
import { Button } from "./ui";

export function StoreBuyBox({
  productId,
  variants,
}: {
  productId: string;
  variants: Array<{ id: string; variantName: string }>;
}) {
  const router = useRouter();
  const [variantId, setVariantId] = useState(variants[0]?.id ?? "default");

  return (
    <div className="space-y-3">
      {variants.length > 1 ? (
        <label className="block text-sm">
          <span className="text-xs uppercase tracking-wider text-faint">Option</span>
          <select
            className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2"
            value={variantId}
            onChange={(e) => setVariantId(e.target.value)}
          >
            {variants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {humanizeVariantLabel(variant.variantName)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <Button
        tone="accent"
        className="w-full"
        onClick={() => {
          addStoreCartLine({ productId, variantId, qty: 1 });
          router.push("/store/cart");
        }}
      >
        Add to bag
      </Button>
    </div>
  );
}
