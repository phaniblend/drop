import Link from "next/link";
import { listProducts } from "@/lib/db/queries";
import { money, pct } from "@/lib/utils";
import { Badge, Button, Card } from "@/components/ui";
import { StatusPill } from "@/components/status-pill";
import { Thumb } from "@/components/thumb";

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const all = await listProducts();
  const rows = status ? all.filter((p) => p.status === status) : all;
  const filters = ["all", "draft", "ready", "published"];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">Catalog</p>
          <h1 className="mt-1 text-2xl font-semibold">SKUs you can actually sell</h1>
          <p className="mt-1 text-sm text-muted">
            Drafts stay local. Publish pushes to Shopify when a token is present, otherwise it is marked
            published in the desk.
          </p>
        </div>
        <Link href="/discover">
          <Button tone="accent">Import product</Button>
        </Link>
      </div>

      <div className="flex gap-2">
        {filters.map((f) => (
          <Link
            key={f}
            href={f === "all" ? "/catalog" : `/catalog?status=${f}`}
            className={`rounded-full border px-3 py-1 text-xs capitalize ${
              (status ?? "all") === f
                ? "border-accent bg-[rgba(74,163,255,0.12)]"
                : "border-line text-muted"
            }`}
          >
            {f}
          </Link>
        ))}
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-[11px] uppercase tracking-wider text-faint">
            <tr>
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">Landed</th>
              <th className="px-4 py-3 font-medium">Retail</th>
              <th className="px-4 py-3 font-medium">Margin</th>
              <th className="px-4 py-3 font-medium">Stock</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((p) => (
              <tr key={p.id} className="hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <Link href={`/catalog/${p.id}`} className="flex items-center gap-3">
                    <Thumb src={p.imageUrl} alt="" className="h-11 w-11" />
                    <span>
                      <span className="block font-medium">{p.cleanTitle ?? p.rawTitle}</span>
                      <span className="text-xs text-muted">{p.supplierName}</span>
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  {money(p.baseCost + p.shippingCost)}
                </td>
                <td className="px-4 py-3 font-mono text-xs">{money(p.retailPrice)}</td>
                <td className="px-4 py-3">
                  <Badge tone={p.economics.margin >= 0.45 ? "profit" : "warn"}>
                    {pct(p.economics.margin)}
                  </Badge>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{p.stock}</td>
                <td className="px-4 py-3">
                  <StatusPill value={p.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
