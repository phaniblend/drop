import { DeskLink } from "@/components/desk-link";
import { getOperator, listProducts } from "@/lib/db/queries";
import { storeHomePath } from "@/lib/store-slug";
import { money, pct } from "@/lib/utils";
import { breakevenRoas } from "@/lib/money";
import { Badge, Button, Card } from "@/components/ui";
import { StatusPill } from "@/components/status-pill";
import { Thumb } from "@/components/thumb";
import { RemoveProductButton } from "@/components/remove-product-button";

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; upgraded?: string; session_id?: string }>;
}) {
  const { status, upgraded, session_id: sessionId } = await searchParams;
  if (sessionId) {
    try {
      await import("@/lib/billing").then((m) => m.fulfillBillingCheckout(sessionId));
    } catch {
      /* webhook still applies the plan */
    }
  }
  const [all, operator] = await Promise.all([listProducts(), getOperator()]);
  const storeHref = storeHomePath(operator?.storeSlug);
  const rows = status ? all.filter((p) => p.status === status) : all;
  const filters = [
    { id: "all", label: "All" },
    { id: "draft", label: "Draft" },
    { id: "ready", label: "Ready" },
    { id: "local_only", label: "Local only" },
    { id: "published", label: "Published" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">Catalog</p>
          <h1 className="mt-1 text-2xl font-semibold">Products you can actually sell</h1>
          <p className="mt-1 text-sm text-muted">
            Drafts stay on the desk. Publish puts the product on your Seto store for shoppers.
          </p>
          {upgraded ? (
            <p className="mt-2 text-sm text-profit">
              {upgraded === "scaler" ? "Scaler" : "Starter"} is on. Monthly import quota has reset.
            </p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <DeskLink href={storeHref}>
            <Button tone="line">Open your store</Button>
          </DeskLink>
          <DeskLink href="/discover">
            <Button tone="accent">What do you want to sell?</Button>
          </DeskLink>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {filters.map((f) => (
          <DeskLink
            key={f.id}
            href={f.id === "all" ? "/catalog" : `/catalog?status=${f.id}`}
            className={`rounded-full border px-3 py-1 text-xs ${
              (status ?? "all") === f.id
                ? "border-accent bg-accent/10"
                : "border-line text-muted"
            }`}
          >
            {f.label}
          </DeskLink>
        ))}
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-[11px] uppercase tracking-wider text-faint">
            <tr>
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">Landed cost</th>
              <th className="px-4 py-3 font-medium">Selling price</th>
              <th className="px-4 py-3 font-medium">Margin</th>
              <th className="px-4 py-3 font-medium">Stock</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((p) => (
              <tr key={p.id} className="hover:bg-black/[0.02]">
                <td className="px-4 py-3">
                  <DeskLink href={`/catalog/${p.id}`} className="flex items-center gap-3">
                    <Thumb src={p.imageUrl} alt="" className="h-11 w-11" />
                    <span>
                      <span className="block font-medium">{p.cleanTitle ?? p.rawTitle}</span>
                      <span className="text-xs text-muted">{p.supplierName}</span>
                    </span>
                  </DeskLink>
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  {money(p.baseCost + p.shippingCost)}
                </td>
                <td className="px-4 py-3 font-mono text-xs">{money(p.retailPrice)}</td>
                <td className="px-4 py-3">
                  {(() => {
                    const be = breakevenRoas(p.retailPrice, p.baseCost, p.shippingCost);
                    const hard = Number.isFinite(be) && be > 2.5;
                    return (
                      <Badge tone={hard ? "loss" : p.economics.margin >= 0.45 ? "profit" : "warn"}>
                        {hard ? `BE ${be.toFixed(1)}x` : pct(p.economics.margin)}
                      </Badge>
                    );
                  })()}
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  {p.outOfStock ? (
                    <Badge tone="loss">Out of stock</Badge>
                  ) : (
                    <>
                      {p.stock}
                      {p.sellableVariants != null && p.variants?.length > 1
                        ? ` · ${p.sellableVariants}/${p.variants.length} opts`
                        : ""}
                    </>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusPill value={p.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  <RemoveProductButton
                    productId={p.id}
                    productTitle={p.cleanTitle || p.rawTitle}
                    label="Remove"
                    tone="ghost"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
