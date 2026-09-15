"use client";

import { useMemo, useState, useTransition } from "react";
import { attachTracking, markOrdersPlaced } from "@/app/actions/orders";
import { money } from "@/lib/utils";
import { Badge, Button, Card, CardHeader, Field, inputClass } from "./ui";
import { CopyButton } from "./copy-button";
import type { Order, OrderItem } from "@/lib/db/schema";

type Row = Order & { items: OrderItem[] };

export function FulfillmentBoard({
  pending,
  awaitingTracking,
}: {
  pending: Row[];
  awaitingTracking: Row[];
}) {
  const [selected, setSelected] = useState<string[]>(pending.map((o) => o.id));
  const [supplierId, setSupplierId] = useState("");
  const [pendingTx, start] = useTransition();
  const [tracking, setTracking] = useState<Record<string, { tracking: string; carrier: string }>>({});

  const chosen = useMemo(
    () => pending.filter((o) => selected.includes(o.id)),
    [pending, selected],
  );

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">Fulfill</p>
          <h1 className="mt-1 text-2xl font-semibold">Batch supplier checkout</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Copy the address, place the order on AliExpress/CJ, then stamp the supplier order id.
            Export CSV if you use a bulk order tool.
          </p>
        </div>
        <a href="/api/export/fulfillment">
          <Button tone="line">Download batch CSV</Button>
        </a>
      </div>

      <Card>
        <CardHeader
          title={`${pending.length} waiting to place`}
          eyebrow="Session"
          action={<Badge tone="warn">{chosen.length} selected</Badge>}
        />
        <div className="divide-y divide-line">
          {pending.map((order) => (
            <div key={order.id} className="grid gap-4 px-5 py-4 lg:grid-cols-[auto_1fr_auto]">
              <input
                type="checkbox"
                className="mt-1 accent-[#4aa3ff]"
                checked={selected.includes(order.id)}
                onChange={() => toggle(order.id)}
              />
              <div>
                <p className="text-sm font-semibold">
                  {order.orderNumber} · {order.customerName}
                </p>
                <p className="mt-1 text-sm text-ink">{order.shippingAddress}</p>
                <p className="mt-2 text-xs text-muted">
                  {order.items.map((i) => `${i.quantity}× ${i.title} (${i.sku})`).join(" · ")}
                </p>
                <p className="mt-1 font-mono text-xs text-faint">
                  Pay supplier {money(order.totalCogs)} · keep {money(order.netMargin)} before ads
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <CopyButton text={`${order.customerName}\n${order.shippingAddress}`} label="Copy address" />
                {order.items[0]?.supplierUrl ? (
                  <a href={order.items[0].supplierUrl} target="_blank" className="text-xs text-accent">
                    Open supplier
                  </a>
                ) : null}
              </div>
            </div>
          ))}
          {pending.length === 0 ? (
            <p className="px-5 py-8 text-sm text-muted">Queue is clear. Nice.</p>
          ) : null}
        </div>
        {pending.length > 0 ? (
          <div className="flex flex-wrap items-end gap-3 border-t border-line px-5 py-4">
            <Field label="Supplier order id">
              <input
                className={inputClass}
                placeholder="AE8821…"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
              />
            </Field>
            <Button
              tone="accent"
              disabled={pendingTx || chosen.length === 0}
              onClick={() => start(() => markOrdersPlaced(chosen.map((o) => o.id), supplierId))}
            >
              Mark {chosen.length} placed
            </Button>
          </div>
        ) : null}
      </Card>

      <Card>
        <CardHeader title="Paste tracking" eyebrow="In transit" />
        <div className="divide-y divide-line">
          {awaitingTracking.map((order) => {
            const draft = tracking[order.id] ?? { tracking: "", carrier: order.carrier ?? "YunExpress" };
            return (
              <div key={order.id} className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_160px_160px_auto]">
                <div>
                  <p className="text-sm font-medium">
                    {order.orderNumber} · {order.customerName}
                  </p>
                  <p className="text-xs text-muted">{order.supplierOrderId ?? "No supplier id"}</p>
                </div>
                <input
                  className={inputClass}
                  placeholder="Tracking"
                  value={draft.tracking}
                  onChange={(e) =>
                    setTracking((t) => ({ ...t, [order.id]: { ...draft, tracking: e.target.value } }))
                  }
                />
                <input
                  className={inputClass}
                  placeholder="Carrier"
                  value={draft.carrier}
                  onChange={(e) =>
                    setTracking((t) => ({ ...t, [order.id]: { ...draft, carrier: e.target.value } }))
                  }
                />
                <Button
                  tone="line"
                  disabled={pendingTx || !draft.tracking}
                  onClick={() => start(() => attachTracking(order.id, draft.tracking, draft.carrier))}
                >
                  Save
                </Button>
              </div>
            );
          })}
          {awaitingTracking.length === 0 ? (
            <p className="px-5 py-8 text-sm text-muted">No orders waiting on tracking.</p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
