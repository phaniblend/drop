"use client";

import { useState } from "react";
import { resolveRefund } from "@/app/actions/ops";
import { Badge, Button, Card, CardHeader } from "./ui";
import { CopyButton } from "./copy-button";
import { TaskToggle } from "./task-toggle";
import { OrganicLaunchCard } from "./organic-launch-card";
import { money } from "@/lib/utils";
import type { CsMacro, DailyTask, Order, Product, Refund } from "@/lib/db/schema";

function fillMacro(body: string, order?: Order) {
  return body
    .replaceAll("{{name}}", order?.customerName.split(" ")[0] ?? "there")
    .replaceAll("{{order}}", order?.orderNumber ?? "{{order}}")
    .replaceAll("{{tracking}}", order?.trackingNumber ?? "not yet assigned")
    .replaceAll("{{carrier}}", order?.carrier ?? "the carrier");
}

export function OpsDesk({
  tasks,
  macros,
  refunds,
  stale,
  products,
}: {
  tasks: DailyTask[];
  macros: CsMacro[];
  refunds: Array<Refund & { order?: Order }>;
  stale: Order[];
  products: Product[];
}) {
  const [orderPick, setOrderPick] = useState(stale[0]?.id ?? "");
  const selected = stale.find((o) => o.id === orderPick) ?? stale[0];

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">Daily ops</p>
        <h1 className="mt-1 text-2xl font-semibold">The boring work that keeps refunds down</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Existing dropshippers live in this screen: “where’s my order?” replies, stale tracking, and refund
          triage. Saved replies fill from the selected aging order.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader title="Today's loop" eyebrow="Checklist" />
          <div className="space-y-2 px-4 py-4">
            {tasks.map((t) => (
              <TaskToggle key={t.id} id={t.id} done={t.done} title={t.title} detail={t.detail} />
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="Aging shipments" eyebrow="Where is it?" />
          <div className="space-y-2 px-4 py-4">
            {stale.length === 0 ? (
              <p className="text-sm text-muted">Nothing stale. Check back tomorrow.</p>
            ) : (
              stale.map((o) => (
                <button
                  key={o.id}
                  onClick={() => setOrderPick(o.id)}
                  className={`block w-full rounded-xl border px-3 py-3 text-left ${
                    selected?.id === o.id ? "border-accent bg-accent/10" : "border-line"
                  }`}
                >
                  <p className="text-sm font-medium">
                    {o.orderNumber} · {o.customerName}
                  </p>
                  <p className="text-xs text-muted">
                    {o.trackingNumber ?? "No tracking"} · {o.carrier ?? "—"}
                  </p>
                </button>
              ))
            )}
          </div>
        </Card>
      </div>

      <div id="organic">
        <OrganicLaunchCard products={products} catalogCount={products.length} />
      </div>

      <Card>
        <CardHeader title="Saved replies" eyebrow="Customer messages" />
        <div className="grid gap-3 p-4 md:grid-cols-2">
          {macros.map((m) => {
            const body = fillMacro(m.body, selected);
            return (
              <div key={m.id} className="rounded-xl border border-line bg-bg p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-faint">{m.category}</p>
                    <p className="text-sm font-semibold">{m.title}</p>
                  </div>
                  <CopyButton text={body} />
                </div>
                <p className="mt-3 text-sm text-muted">{body}</p>
              </div>
            );
          })}
        </div>
      </Card>

      <div id="refunds">
        <Card>
          <CardHeader title="Refund queue" eyebrow="Keep the review" />
          <div className="divide-y divide-line">
            {refunds.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted">No open refunds. This stays empty until a customer asks for one.</p>
            ) : null}
            {refunds.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div>
                  <p className="text-sm font-medium">
                    {r.order?.orderNumber ?? "Order"} · {money(r.amount)}
                  </p>
                  <p className="text-xs text-muted">{r.reason}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={r.status === "open" ? "loss" : "profit"}>{r.status}</Badge>
                  {r.status === "open" ? (
                    <Button tone="line" onClick={() => resolveRefund(r.id, "resolved")}>
                      Mark resolved
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
