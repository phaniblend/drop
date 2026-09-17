import Link from "next/link";
import { listOrders } from "@/lib/db/queries";
import { money, shortDate } from "@/lib/utils";
import { Button, Card } from "@/components/ui";
import { StatusPill } from "@/components/status-pill";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "pending_batch", label: "Waiting to ship" },
  { id: "ordered_supplier", label: "At supplier" },
  { id: "shipped", label: "Shipped" },
  { id: "delivered", label: "Delivered" },
  { id: "refunded", label: "Refunded" },
];

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const rows = await listOrders(status && status !== "all" ? status : undefined);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">Orders</p>
          <h1 className="mt-1 text-2xl font-semibold">Every checkout, with true net</h1>
          <p className="mt-1 text-sm text-muted">
            Net already subtracts what you paid for the products and card fees. Ad spend is attributed on the Ads desk, not
            double-counted here.
          </p>
        </div>
        <Link href="/fulfillment">
          <Button tone="accent">Open fulfillment session</Button>
        </Link>
      </div>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.id}
            href={f.id === "all" ? "/orders" : `/orders?status=${f.id}`}
            className={`rounded-full border px-3 py-1 text-xs ${
              (status ?? "all") === f.id
                ? "border-accent bg-accent/10"
                : "border-line text-muted"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-line text-[11px] uppercase tracking-wider text-faint">
            <tr>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Items</th>
              <th className="px-4 py-3">Revenue</th>
              <th className="px-4 py-3">Net</th>
              <th className="px-4 py-3">Tracking</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((o) => (
              <tr key={o.id} className="hover:bg-black/[0.02]">
                <td className="px-4 py-3">
                  <p className="font-medium">{o.orderNumber}</p>
                  <p className="text-[11px] text-faint">{shortDate(o.createdAt)}</p>
                </td>
                <td className="px-4 py-3">
                  <p>{o.customerName}</p>
                  <p className="text-xs text-muted">{o.shippingAddress}</p>
                </td>
                <td className="px-4 py-3 text-xs text-muted">
                  {o.items.map((i) => `${i.quantity}× ${i.title}`).join(", ")}
                </td>
                <td className="px-4 py-3 font-mono text-xs">{money(o.totalRevenue)}</td>
                <td className="px-4 py-3 font-mono text-xs text-profit">{money(o.netMargin)}</td>
                <td className="px-4 py-3 font-mono text-xs">{o.trackingNumber ?? "—"}</td>
                <td className="px-4 py-3">
                  <StatusPill value={o.fulfillmentStatus} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
