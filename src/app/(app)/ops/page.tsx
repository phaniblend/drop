import { getDashboard, listMacros } from "@/lib/db/queries";
import { OpsDesk } from "@/components/ops-desk";

export default async function OpsPage() {
  const [data, macros] = await Promise.all([getDashboard(), listMacros()]);
  return (
    <OpsDesk
      tasks={data.tasks}
      macros={macros}
      refunds={data.refunds}
      stale={data.staleOrders}
      products={data.catalog}
    />
  );
}
