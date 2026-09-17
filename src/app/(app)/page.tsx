import Link from "next/link";
import { getDashboard } from "@/lib/db/queries";
import { money, pct } from "@/lib/utils";
import { Badge, Button, Card, CardHeader, Kpi } from "@/components/ui";
import { StatusPill } from "@/components/status-pill";
import { TaskToggle } from "@/components/task-toggle";
import { Thumb } from "@/components/thumb";
import { OrganicLaunchCard } from "@/components/organic-launch-card";

export default async function CommandPage() {
  const data = await getDashboard();
  const { kpis } = data;
  const profitTone = kpis.profit >= 0 ? "profit" : "loss";
  const maxBar = Math.max(...data.last7.map((d) => Math.abs(d.revenue)), 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">Command</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
            {data.user?.displayName ?? "Operator"}, here is today
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Net profit uses the spec formula: revenue − COGS − ad spend − (revenue × 2.9% + $0.30).
            Connect Shopify, Meta, and TikTok when you are ready — the desk stays empty until live orders land.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/fulfillment">
            <Button tone="accent">Clear {data.pendingCount} unfulfilled</Button>
          </Link>
          <Link href="/discover">
            <Button tone="line">Find a test SKU</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Revenue (24h)" value={money(kpis.revenue)} hint={`${kpis.orders} orders`} />
        <Kpi label="COGS" value={money(kpis.cogs)} />
        <Kpi label="Ad spend" value={money(kpis.adSpend)} />
        <Kpi label="Processor fees" value={money(kpis.fees)} />
        <Kpi label="Net profit" value={money(kpis.profit)} tone={profitTone} hint={pct(kpis.avgMargin)} />
        <Kpi
          label="Needs you"
          value={String(data.pendingCount + data.needTrackingCount)}
          tone="warn"
          hint={`${data.pendingCount} to place · ${data.needTrackingCount} tracking`}
        />
      </div>

      {data.alerts.length > 0 ? (
        <Card>
          <CardHeader eyebrow="Triage" title="What will lose money if you ignore it" />
          <ul className="divide-y divide-line">
            {data.alerts.map((alert) => (
              <li key={alert.title + alert.detail} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{alert.title}</p>
                  <p className="text-xs text-muted">{alert.detail}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone={alert.tone === "loss" ? "loss" : "warn"}>{alert.tone}</Badge>
                  <Link href={alert.href} className="text-xs text-accent">
                    Open
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader eyebrow="7 days" title="Revenue vs net" />
          <div className="flex h-48 items-end gap-3 px-5 py-4">
            {data.last7.map((d) => (
              <div key={d.key} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex h-32 w-full items-end justify-center gap-1">
                  <div
                    className="w-3 rounded-sm bg-accent/70"
                    style={{ height: `${Math.max(8, (d.revenue / maxBar) * 100)}%` }}
                    title={`Revenue ${money(d.revenue)}`}
                  />
                  <div
                    className={`w-3 rounded-sm ${d.profit >= 0 ? "bg-profit/80" : "bg-loss/80"}`}
                    style={{ height: `${Math.max(8, (Math.abs(d.profit) / maxBar) * 100)}%` }}
                    title={`Profit ${money(d.profit)}`}
                  />
                </div>
                <p className="text-[11px] text-faint">{d.label}</p>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader eyebrow="Today" title="Daily checklist" />
          <div className="space-y-2 px-4 py-4">
            {data.tasks.map((task) => (
              <TaskToggle
                key={task.id}
                id={task.id}
                done={task.done}
                title={task.title}
                detail={task.detail}
              />
            ))}
          </div>
        </Card>
      </div>

      <OrganicLaunchCard products={data.organicQueue} catalogCount={data.catalog.length} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            eyebrow="Orders"
            title="Latest checkouts"
            action={
              <Link href="/orders" className="text-xs text-accent">
                All orders
              </Link>
            }
          />
          <div className="divide-y divide-line">
            {data.recentOrders.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted">No checkouts yet.</p>
            ) : (
              data.recentOrders.map((order) => (
              <div key={order.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-5">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {order.orderNumber} · {order.customerName}
                  </p>
                  <p className="text-xs text-muted">
                    {order.items.map((i) => i.title).join(", ")} · {money(order.netMargin)} net
                  </p>
                </div>
                <StatusPill value={order.fulfillmentStatus} />
              </div>
              ))
            )}
          </div>
        </Card>
        <Card>
          <CardHeader eyebrow="Catalog" title="Profit by SKU (unit × sold)" />
          <div className="divide-y divide-line">
            {data.topProducts.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted">Catalog is empty. Import a test SKU from Discover.</p>
            ) : (
              data.topProducts.map((p) => (
              <Link
                key={p.id}
                href={`/catalog/${p.id}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-black/[0.02]"
              >
                <Thumb src={p.imageUrl} alt="" className="h-10 w-10" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.cleanTitle ?? p.rawTitle}</p>
                  <p className="text-xs text-muted">
                    {p.sold} sold · {money(p.economics.profit)} / unit
                  </p>
                </div>
                <p className="font-mono text-sm text-profit">{money(p.profit)}</p>
              </Link>
              ))
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader eyebrow="Feed" title="Activity" />
        <ul className="divide-y divide-line">
          {data.activity.length === 0 ? (
            <li className="px-5 py-6 text-sm text-muted">No activity yet.</li>
          ) : (
            data.activity.map((item) => (
            <li key={item.id} className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <span className="text-ink">{item.message}</span>
              {item.href ? (
                <Link href={item.href} className="shrink-0 text-xs text-accent">
                  View
                </Link>
              ) : null}
            </li>
            ))
          )}
        </ul>
      </Card>
    </div>
  );
}
