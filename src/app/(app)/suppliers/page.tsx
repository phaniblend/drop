import { DeskLink } from "@/components/desk-link";
import { listSuppliers } from "@/lib/db/queries";
import { money, pct } from "@/lib/utils";
import { LOW_STOCK_THRESHOLD, isLowStock } from "@/lib/stock-threshold";
import { Badge, Button, Card, CardHeader } from "@/components/ui";
import { Thumb } from "@/components/thumb";

export default async function SuppliersPage() {
  const vendors = await listSuppliers();
  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">Suppliers</p>
        <h1 className="mt-1 text-2xl font-semibold">Who you actually buy from</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Watch stock on winners. Low stock is under {LOW_STOCK_THRESHOLD} pcs — pause ads before the
          factory runs out.
        </p>
      </div>

      {vendors.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm font-medium text-ink">No suppliers yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Import a product from Discover and it will show up here with cost, transit time, and stock
            from your catalog.
          </p>
          <DeskLink href="/discover" className="mt-5 inline-block">
            <Button tone="accent">Find a product</Button>
          </DeskLink>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {vendors.map((s) => (
          <Card key={s.id} className="p-5">
            <p className="text-xs uppercase tracking-wider text-faint">{s.platform}</p>
            <h2 className="mt-1 text-lg font-semibold">{s.name}</h2>
            <p className="mt-2 text-sm text-muted">{s.notes}</p>
            <dl className="mt-4 grid grid-cols-2 gap-2 font-mono text-xs">
              <div>
                <dt className="text-faint">Transit</dt>
                <dd>{s.avgShippingDays} days</dd>
              </div>
              <div>
                <dt className="text-faint">Reliability</dt>
                <dd>{pct(s.reliability)}</dd>
              </div>
            </dl>
            {s.storeUrl ? (
              <a href={s.storeUrl} className="mt-3 inline-block text-xs text-accent" target="_blank">
                Open store
              </a>
            ) : null}
          </Card>
        ))}
      </div>
      {vendors.map((s) => (
        <Card key={`${s.id}-skus`}>
          <CardHeader
            title={s.name}
            eyebrow="Products you sell"
            action={
              s.lowStock.length ? (
                <Badge tone="loss">{s.lowStock.length} low stock</Badge>
              ) : (
                <Badge tone="profit">Healthy</Badge>
              )
            }
          />
          <div className="divide-y divide-line">
            {s.skus.map((p) => (
              <DeskLink
                key={p.id}
                href={`/catalog/${p.id}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-black/[0.02]"
              >
                <Thumb src={p.imageUrl} alt="" className="h-10 w-10" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.cleanTitle ?? p.rawTitle}</p>
                  <p className="text-xs text-muted">
                    Your cost {money(p.baseCost + p.shippingCost)} · {p.shippingDays}d
                  </p>
                </div>
                <span className={`font-mono text-sm ${isLowStock(p.stock) ? "text-loss" : "text-muted"}`}>
                  {p.stock} pcs
                </span>
              </DeskLink>
            ))}
            {s.skus.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted">No products linked to this supplier yet.</p>
            ) : null}
          </div>
        </Card>
      ))}
    </div>
  );
}
