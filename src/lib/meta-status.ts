export type MetaHealthStatus = "connected" | "degraded" | "offline";

/** Pure helper for tests + UI — classify Meta readiness without network. */
export function classifyMetaStatus(input: {
  hasToken: boolean;
  accountId: string;
  apiOk: boolean;
  longLived: boolean;
  canExtend: boolean;
}): MetaHealthStatus {
  if (!input.hasToken) return "offline";
  if (!input.accountId.trim()) return "degraded";
  if (!input.apiOk) return "degraded";
  if (!input.longLived && !input.canExtend) return "degraded";
  return "connected";
}
