import { listOrders } from "@/lib/db/queries";
import { FulfillmentBoard } from "@/components/fulfillment-board";

export default async function FulfillmentPage() {
  const [pending, atSupplier] = await Promise.all([
    listOrders("pending_batch"),
    listOrders("ordered_supplier"),
  ]);
  const awaitingTracking = atSupplier.filter((o) => !o.trackingNumber);
  return <FulfillmentBoard pending={pending} awaitingTracking={awaitingTracking} />;
}
