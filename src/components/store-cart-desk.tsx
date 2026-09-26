"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { readStoreCart, writeStoreCart, type StoreCartLine } from "@/lib/store-cart";
import { postJson } from "@/lib/retry-fetch";
import { money } from "@/lib/utils";
import { Button } from "./ui";

type CatalogLine = {
  productId: string;
  variantId: string;
  title: string;
  qty: number;
  unitPrice: number;
  stock: number;
};

export function StoreCartDesk({
  catalog,
  canceled = false,
}: {
  catalog: CatalogLine[];
  canceled?: boolean;
}) {
  const [lines, setLines] = useState<StoreCartLine[]>([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setLines(readStoreCart());
  }, []);

  const priced = lines
    .map((line) => {
      const match = catalog.find(
        (item) => item.productId === line.productId && item.variantId === line.variantId,
      );
      if (!match) return null;
      return { ...match, qty: Math.min(line.qty, Math.max(match.stock, 0)) };
    })
    .filter((row): row is CatalogLine => Boolean(row));
  const payable = priced.filter((line) => line.qty >= 1 && line.stock >= 1);
  const total = payable.reduce((sum, line) => sum + line.unitPrice * line.qty, 0);

  function updateQty(productId: string, variantId: string, qty: number, stock: number) {
    const next = lines
      .map((line) =>
        line.productId === productId && line.variantId === variantId
          ? { ...line, qty: Math.min(Math.max(qty, 0), stock) }
          : line,
      )
      .filter((line) => line.qty > 0);
    setLines(next);
    writeStoreCart(next);
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">Bag</p>
        <h1 className="mt-1 text-2xl font-semibold">Your order</h1>
      </div>
      {canceled ? <p className="text-sm text-muted">Checkout canceled — your bag is saved.</p> : null}
      {priced.length === 0 ? (
        <p className="text-sm text-muted">
          Nothing here yet.{" "}
          <Link href="/store" className="text-accent">
            Browse the store
          </Link>
          .
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {priced.map((line) => (
            <li key={`${line.productId}-${line.variantId}`} className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm font-medium">{line.title}</p>
                <p className="text-xs text-muted">
                  {money(line.unitPrice)} each
                  {line.stock ? ` · ${line.stock} left` : " · sold out"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="h-8 w-8 rounded-lg border border-line"
                  onClick={() => updateQty(line.productId, line.variantId, line.qty - 1, line.stock)}
                >
                  −
                </button>
                <span className="w-6 text-center text-sm">{line.qty}</span>
                <button
                  type="button"
                  className="h-8 w-8 rounded-lg border border-line"
                  disabled={line.qty >= line.stock}
                  onClick={() => updateQty(line.productId, line.variantId, line.qty + 1, line.stock)}
                >
                  +
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {priced.length ? (
        <div className="space-y-1 text-sm">
          <p className="font-medium">Items {money(total)}</p>
          <p className="text-xs text-muted">Shipping and tax are collected on the card page when they apply.</p>
        </div>
      ) : null}
      {error ? <p className="text-sm text-loss">{error}</p> : null}
      {payable.length > 0 ? (
        <Button
          tone="accent"
          disabled={pending}
          onClick={async () => {
            setError("");
            setPending(true);
            try {
              const res = await postJson<{ url: string }>("/api/store/checkout", { lines: payable });
              window.location.href = res.url;
            } catch (err) {
              setError(err instanceof Error ? err.message : "Checkout failed. Try again.");
              setPending(false);
            }
          }}
        >
          {pending ? "Opening checkout…" : "Pay with card"}
        </Button>
      ) : null}
    </div>
  );
}
