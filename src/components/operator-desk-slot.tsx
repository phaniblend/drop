import { OperatorDeskWidget } from "@/components/operator-desk-widget";
import { getOrCreateTodayDirective } from "@/lib/operator-desk-run";

export async function OperatorDeskSlot() {
  let directive: Awaited<ReturnType<typeof getOrCreateTodayDirective>> = null;
  try {
    directive = await getOrCreateTodayDirective();
  } catch {
    directive = null;
  }
  return <OperatorDeskWidget directive={directive} />;
}
