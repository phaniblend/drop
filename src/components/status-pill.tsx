import { Badge } from "@/components/ui";

const ORDER: Record<string, { label: string; tone: "line" | "accent" | "profit" | "loss" | "warn" }> = {
  pending_batch: { label: "Waiting to ship", tone: "warn" },
  ordered_supplier: { label: "At supplier", tone: "accent" },
  shipped: { label: "Shipped", tone: "accent" },
  delivered: { label: "Delivered", tone: "profit" },
  refunded: { label: "Refunded", tone: "loss" },
  cancelled: { label: "Cancelled", tone: "line" },
  draft: { label: "Draft", tone: "line" },
  ready: { label: "Ready", tone: "warn" },
  local_only: { label: "Local only", tone: "warn" },
  published: { label: "Published", tone: "profit" },
  archived: { label: "Archived", tone: "line" },
};

export function StatusPill({ value }: { value: string }) {
  const meta = ORDER[value] ?? { label: value, tone: "line" as const };
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}
