import Link from "next/link";
import { notFound } from "next/navigation";
import { getOperator, getOrder } from "@/lib/db/queries";
import { money, shortDate } from "@/lib/utils";
import { Button, Card, CardHeader } from "@/components/ui";
import { StatusPill } from "@/components/status-pill";
import { customerDisplayName, mailingLabel } from "@/lib/fulfillment-copy";
import { OrderRefundButton } from "@/components/order-refund-button";
import { OrderFulfillmentEditor } from "@/components/order-fulfillment-editor";
import { DeletePracticeOrderButton } from "@/components/delete-practice-order-button";
import { isPracticeOrder } from "@/lib/practice-order";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [order, operator] = await Promise.all([getOrder(id), getOperator()]);
  if (!order) notFound();
  const tz = operator?.timezone || "America/Chicago";
  const name = customerDisplayName(order.customerName, order.customerEmail);
  const address = mailingLabel(name, order.shippingAddress);
  const practice = isPracticeOrder(order);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/orders" className="text-xs text-accent">
          ← All orders
        </Link>
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.2em] text-accent">Order</p>
        <h1 className="mt-1 text-2xl font-semibold">{order.orderNumber}</h1>
        {practice ? (
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-warn">
            Practice · not real revenue
          </p>
        ) : null}
        <p className="mt-1 text-sm text-muted">{shortDate(order.createdAt, tz)}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Customer" eyebrow="Buyer" />
          <div className="space-y-2 px-5 py-4 text-sm">
            <p className="font-semibold">{name}</p>
            <p>
              <a className="text-accent" href={`mailto:${order.customerEmail}`}>
                {order.customerEmail}
              </a>
            </p>
            <p className="whitespace-pre-line text-muted">{address}</p>
          </div>
        </Card>
        <Card>
          <CardHeader title="Status" eyebrow="Fulfillment" action={<StatusPill value={order.fulfillmentStatus} />} />
          <div className="space-y-3 px-5 py-4 text-sm">
            <p>
              {practice ? "Practice total" : "Paid"} {money(order.totalRevenue)} · net{" "}
              {money(order.netMargin)}
            </p>
            <p className="text-muted">
              {order.trackingNumber
                ? `${order.carrier ?? "Carrier"} ${order.trackingNumber}`
                : "No tracking yet"}
            </p>
            {order.supplierOrderId ? (
              <p className="text-xs text-faint">Supplier id {order.supplierOrderId}</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <a href={`mailto:${order.customerEmail}?subject=${encodeURIComponent(`Order ${order.orderNumber}`)}`}>
                <Button tone="line">Email buyer</Button>
              </a>
              {practice ? <DeletePracticeOrderButton orderId={order.id} /> : null}
              {!practice && order.fulfillmentStatus !== "refunded" ? (
                <OrderRefundButton orderId={order.id} />
              ) : null}
            </div>
            {order.fulfillmentStatus !== "refunded" ? (
              <OrderFulfillmentEditor
                orderId={order.id}
                fulfillmentStatus={order.fulfillmentStatus}
                supplierOrderId={order.supplierOrderId}
                trackingNumber={order.trackingNumber}
                carrier={order.carrier}
              />
            ) : null}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Items" eyebrow="What they bought" />
        <ul className="divide-y divide-line">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
              <p>
                {item.quantity}× {item.title}
              </p>
              <p className="font-mono text-xs">{money(item.unitPrice * item.quantity)}</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
