"use client";

import { useState, useTransition } from "react";
import { updateOrderFulfillment } from "@/app/actions/orders";
import { Button, Field, inputClass } from "./ui";

export function OrderFulfillmentEditor({
  orderId,
  fulfillmentStatus,
  supplierOrderId,
  trackingNumber,
  carrier,
}: {
  orderId: string;
  fulfillmentStatus: string;
  supplierOrderId: string | null;
  trackingNumber: string | null;
  carrier: string | null;
}) {
  const [pending, start] = useTransition();
  const [supplierId, setSupplierId] = useState(supplierOrderId ?? "");
  const [tracking, setTracking] = useState(trackingNumber ?? "");
  const [shipCarrier, setShipCarrier] = useState(carrier ?? "YunExpress");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  function run(label: string, input: Parameters<typeof updateOrderFulfillment>[1]) {
    start(async () => {
      setError("");
      setMsg("");
      try {
        await updateOrderFulfillment(orderId, input);
        setMsg(label);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not update fulfillment.");
      }
    });
  }

  return (
    <div className="space-y-3 border-t border-line pt-3">
      <p className="text-xs font-medium text-ink">Edit fulfillment</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Supplier order id">
          <input
            className={inputClass}
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            placeholder="AE8821…"
          />
        </Field>
        <Field label="Carrier">
          <input
            className={inputClass}
            value={shipCarrier}
            onChange={(e) => setShipCarrier(e.target.value)}
            placeholder="YunExpress"
          />
        </Field>
        <Field label="Tracking">
          <input
            className={inputClass}
            value={tracking}
            onChange={(e) => setTracking(e.target.value)}
            placeholder="Tracking number"
          />
        </Field>
      </div>
      {error ? <p className="text-xs text-loss">{error}</p> : null}
      {msg ? <p className="text-xs text-profit">{msg}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button
          tone="accent"
          disabled={pending}
          onClick={() =>
            run("Marked placed.", {
              supplierOrderId: supplierId,
              fulfillmentStatus: "ordered_supplier",
            })
          }
        >
          Save placed
        </Button>
        <Button
          tone="line"
          disabled={pending}
          onClick={() =>
            run("Tracking saved.", {
              trackingNumber: tracking,
              carrier: shipCarrier,
              fulfillmentStatus: "shipped",
            })
          }
        >
          Save shipped
        </Button>
        {fulfillmentStatus === "shipped" || fulfillmentStatus === "delivered" ? (
          <Button
            tone="ghost"
            disabled={pending}
            onClick={() =>
              run("Reverted to at-supplier.", {
                fulfillmentStatus: "ordered_supplier",
                supplierOrderId: supplierId || supplierOrderId || undefined,
              })
            }
          >
            Revert to at supplier
          </Button>
        ) : null}
        {fulfillmentStatus === "ordered_supplier" || fulfillmentStatus === "shipped" ? (
          <Button
            tone="ghost"
            disabled={pending}
            onClick={() => run("Reverted to waiting.", { fulfillmentStatus: "pending_batch" })}
          >
            Revert to waiting
          </Button>
        ) : null}
      </div>
    </div>
  );
}
