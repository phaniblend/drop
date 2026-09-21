import { agingHours, listMacros, listOrders, listProducts, listRefunds, listTasks } from "@/lib/db/queries";
import { OpsDesk } from "@/components/ops-desk";

export default async function OpsPage() {
  const [tasks, macros, refunds, orders, catalog] = await Promise.all([
    listTasks(),
    listMacros(),
    listRefunds(),
    listOrders(),
    listProducts(),
  ]);
  const stale = orders.filter(
    (o) =>
      (o.fulfillmentStatus === "shipped" && agingHours(o) > 24 * 10) ||
      (o.fulfillmentStatus === "ordered_supplier" && agingHours(o) > 48),
  );
  return (
    <OpsDesk
      tasks={tasks}
      macros={macros}
      refunds={refunds}
      stale={stale}
      products={catalog}
    />
  );
}
