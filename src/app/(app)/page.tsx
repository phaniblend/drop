import { DeskLink } from "@/components/desk-link";
import { getDashboard } from "@/lib/db/queries";
import { money, pct } from "@/lib/utils";
import { Button, Card, CardHeader, Kpi } from "@/components/ui";
import { StatusPill } from "@/components/status-pill";
import { Thumb } from "@/components/thumb";
import { OrganicLaunchCard } from "@/components/organic-launch-card";
import { storeHomePath } from "@/lib/store-slug";
import { sellerPublishGaps } from "@/lib/storefront";
import { stripeKeyMode } from "@/lib/stripe-keys";
import { StripeOnboardingGate } from "@/components/stripe-keys-form";
import { maskStripeKey } from "@/lib/stripe-keys";
import { customerDisplayName } from "@/lib/fulfillment-copy";
import { SetupChecklist } from "@/components/setup-checklist";

export default async function CommandPage() {
  const data = await getDashboard();
  const { kpis } = data;
  const profitTone = kpis.profit >= 0 ? "profit" : "loss";
  const maxBar = Math.max(
    1,
    ...data.last7.flatMap((d) => [Math.abs(d.revenue), Math.abs(d.profit)]),
  );
  const barHeight = (value: number) =>
    `${Math.min(100, Math.max(value > 0 ? 4 : 0, (Math.abs(value) / maxBar) * 100))}%`;
  const storeHref = storeHomePath(data.user?.storeSlug);
  const merchantStripe = stripeKeyMode(data.user?.storeStripeSk);
  const stripeLabel =
    merchantStripe === "live" ? "Live" : merchantStripe === "test" ? "Sandbox" : "Not connected";
  const storeLabel =
    merchantStripe === "live" ? "Live" : merchantStripe === "test" ? "Preview" : "Setup needed";
  const meta = await import("@/lib/meta-health").then((m) => m.getMetaHealth(true));
  const adsLabel =
    meta.status === "connected" ? "Ready" : meta.status === "degraded" ? "Expired" : "Pending";
  const findFirst = data.pendingCount === 0;
  const sellerReady = sellerPublishGaps(data.user).length === 0;
  const hasProduct = (data.catalog?.length ?? 0) > 0;
  const hasAngles = (data.catalog ?? []).some((p) => {
    try {
      const raw = (p as { adAnglesJson?: string | null }).adAnglesJson;
      return Boolean(raw && JSON.parse(raw).length);
    } catch {
      return false;
    }
  });
  const setupSteps = [
    {
      id: "business",
      label: "Support email and business address",
      done: sellerReady,
      href: "/settings",
    },
    {
      id: "stripe",
      label: "Connect live Stripe keys",
      done: merchantStripe === "live",
      href: "/settings#stripe",
    },
    {
      id: "meta",
      label: "Connect Meta with Facebook",
      done: meta.status === "connected",
      href: "/settings#meta",
    },
    {
      id: "product",
      label: "Import your first product",
      done: hasProduct,
      href: "/discover",
    },
    {
      id: "adlink",
      label: "Generate ad angles with UTM link",
      done: hasAngles,
      href: hasProduct ? "/catalog" : "/discover",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">Command</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
            {data.user?.displayName ?? "Operator"}, here is today
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            <span>
              Store:{" "}
              <DeskLink href={storeHref} className="text-accent">
                {storeLabel}
              </DeskLink>
            </span>
            <span className="text-faint">|</span>
            <span>Stripe: {stripeLabel}</span>
            <span className="text-faint">|</span>
            <span>Ad Tracking: {adsLabel}</span>
            <span className="text-faint">|</span>
            <span>
              Setup: {setupSteps.filter((s) => s.done).length}/{setupSteps.length}
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Select a product from your catalog and launch your first creative test.
          </p>
        </div>
        <div className="flex gap-2">
          <DeskLink href="/discover">
            <Button tone={findFirst ? "accent" : "line"}>Find a winning product</Button>
          </DeskLink>
          <DeskLink href="/fulfillment">
            <Button tone={findFirst ? "line" : "accent"}>Ship {data.pendingCount} waiting orders</Button>
          </DeskLink>
        </div>
      </div>

      <SetupChecklist steps={setupSteps} />

      <StripeOnboardingGate
        live={merchantStripe === "live"}
        publishableMasked={maskStripeKey(data.user?.storeStripePk)}
        secretMasked={maskStripeKey(data.user?.storeStripeSk)}
        mode={merchantStripe}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Revenue (24h)" value={money(kpis.revenue)} hint={`${kpis.orders} orders`} />
        <Kpi label="Your cost" value={money(kpis.cogs)} />
        <Kpi label="Ad spend" value={money(kpis.adSpend)} />
        <Kpi label="Processor fees" value={money(kpis.fees)} />
        <Kpi
          label="Net profit"
          value={money(kpis.profit)}
          tone={profitTone}
          hint={kpis.revenue > 0 ? pct(kpis.avgMargin) : "—"}
        />
        <Kpi
          label="Needs you"
          value={String(data.pendingCount + data.needTrackingCount)}
          tone="warn"
          hint={`${data.pendingCount} to place · ${data.needTrackingCount} tracking`}
        />
      </div>

      <Card>
        <CardHeader eyebrow="7 days" title="Revenue vs net" />
          <div className="overflow-hidden px-5 py-4">
            {data.last7.every((d) => d.revenue <= 0 && Math.abs(d.profit) <= 0) ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2 text-center">
                <p className="text-sm text-muted">No sales in the last 7 days</p>
                <p className="text-xs text-faint">Bars appear when checkouts or tracked ad spend land.</p>
              </div>
            ) : (
              <>
                <div className="mb-2 flex flex-wrap gap-3 text-[11px] text-faint">
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-sm bg-accent/70" /> Revenue
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-sm bg-profit/80" /> Profit
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-sm bg-loss/80" /> Loss
                  </span>
                </div>
                <div className="flex h-40 items-end gap-3">
                  {data.last7.map((d) => (
                    <div key={d.key} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                      <div className="flex h-28 w-full max-h-28 items-end justify-center gap-1 overflow-hidden">
                        <div
                          className="w-3 max-h-full rounded-sm bg-accent/70"
                          style={{ height: barHeight(d.revenue) }}
                          title={`Revenue ${money(d.revenue)}`}
                        />
                        <div
                          className={`w-3 max-h-full rounded-sm ${d.profit >= 0 ? "bg-profit/80" : "bg-loss/80"}`}
                          style={{ height: barHeight(d.profit) }}
                          title={`Profit ${money(d.profit)}`}
                        />
                      </div>
                      <p className="text-[11px] text-faint">{d.label}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </Card>

      <OrganicLaunchCard products={data.organicQueue} catalogCount={data.catalog.length} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            eyebrow="Orders"
            title="Latest checkouts"
            action={
              <DeskLink href="/orders" className="text-xs text-accent">
                All orders
              </DeskLink>
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
                    <DeskLink href={`/orders/${order.id}`}>
                      {order.orderNumber} · {customerDisplayName(order.customerName, order.customerEmail)}
                    </DeskLink>
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
          <CardHeader eyebrow="Catalog" title="Profit by product (each × sold)" />
          <div className="divide-y divide-line">
            {data.topProducts.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted">
                {data.catalog.length
                  ? "Imported drafts are in Catalog. Open one to set a price and publish."
                  : "Nothing in the catalog yet. Find a product to import."}
              </p>
            ) : (
              data.topProducts.map((p) => (
              <DeskLink
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
              </DeskLink>
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
                <DeskLink href={item.href} className="shrink-0 text-xs text-accent">
                  View
                </DeskLink>
              ) : null}
            </li>
            ))
          )}
        </ul>
      </Card>
    </div>
  );
}
