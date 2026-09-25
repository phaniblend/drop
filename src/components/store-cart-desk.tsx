"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { clearStoreCart, readStoreCart, writeStoreCart, type StoreCartLine } from "@/lib/store-cart";
import { postJson } from "@/lib/retry-fetch";
import { money } from "@/lib/utils";
import { Button } from "./ui";

type CatalogLine = {
  productId: string;
  variantId: string;
  title: string;
  qty: number;
  unitPrice: number;
};

export function StoreCartDesk({ catalog }: { catalog: CatalogLine[] }) {
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
      return match ? { ...match, qty: line.qty } : null;
    })
    .filter((row): row is CatalogLine => Boolean(row));
  const total = priced.reduce((sum, line) => sum + line.unitPrice * line.qty, 0);

  function updateQty(productId: string, variantId: string, qty: number) {
    const next = lines
      .map((line) =>
        line.productId === productId && line.variantId === variantId ? { ...line, qty } : line,
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
                <p className="text-xs text-muted">{money(line.unitPrice)} each</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="h-8 w-8 rounded-lg border border-line"
                  onClick={() => updateQty(line.productId, line.variantId, line.qty - 1)}
                >
                  −
                </button>
                <span className="w-6 text-center text-sm">{line.qty}</span>
                <button
                  type="button"
                  className="h-8 w-8 rounded-lg border border-line"
                  onClick={() => updateQty(line.productId, line.variantId, line.qty + 1)}
                >
                  +
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {priced.length ? <p className="text-sm font-medium">Total {money(total)}</p> : null}
      {error ? <p className="text-sm text-loss">{error}</p> : null}
      <Button
        tone="accent"
        disabled={pending || priced.length === 0}
        onClick={async () => {
          setError("");
          setPending(true);
          try {
            const res = await postJson<{ url: string }>("/api/store/checkout", { lines: priced });
            clearStoreCart();
            window.location.href = res.url;
          } catch (err) {
            setError(err instanceof Error ? err.message : "Checkout failed. Try again.");
            setPending(false);
          }
        }}
      >
        {pending ? "Opening checkout…" : "Pay with card"}
      </Button>
    </div>
  );
}
