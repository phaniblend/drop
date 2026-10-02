"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeProductFromCatalog } from "@/app/actions/products";
import { Button } from "./ui";

export function RemoveProductButton({
  productId,
  productTitle,
  tone = "line",
  className = "",
  label = "Remove",
  redirectTo,
}: {
  productId: string;
  productTitle?: string;
  tone?: "line" | "ghost" | "loss";
  className?: string;
  label?: string;
  /** After remove, navigate here (product detail uses /catalog). */
  redirectTo?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  if (confirming) {
    return (
      <span className={`inline-flex flex-wrap items-center gap-2 ${className}`}>
        <span className="text-xs text-muted">Remove from catalog?</span>
        <Button
          type="button"
          tone="loss"
          className="h-8 px-2 text-xs"
          disabled={pending}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setError("");
            start(async () => {
              try {
                await removeProductFromCatalog(productId);
                if (redirectTo) router.push(redirectTo);
                else router.refresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not remove.");
                setConfirming(false);
              }
            });
          }}
        >
          {pending ? "Removing…" : "Yes, remove"}
        </Button>
        <Button
          type="button"
          tone="ghost"
          className="h-8 px-2 text-xs"
          disabled={pending}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setConfirming(false);
          }}
        >
          Cancel
        </Button>
        {error ? <span className="text-xs text-loss">{error}</span> : null}
      </span>
    );
  }

  return (
    <span className={className}>
      <Button
        type="button"
        tone={tone}
        className="h-8 px-2 text-xs"
        disabled={pending}
        title={productTitle ? `Remove “${productTitle}” from catalog` : "Remove from catalog"}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setConfirming(true);
        }}
      >
        {label}
      </Button>
      {error ? <span className="ml-2 text-xs text-loss">{error}</span> : null}
    </span>
  );
}
