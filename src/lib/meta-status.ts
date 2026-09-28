export type MetaHealthStatus = "connected" | "degraded" | "offline";

/** Shop-facing copy — never show Graph API session dumps. */
export function friendlyMetaError(raw?: string | null) {
  const text = (raw ?? "").trim();
  if (!text) return "Meta Account Disconnected";
  const lower = text.toLowerCase();
  if (
    lower.includes("session has expired") ||
    lower.includes("error validating access token") ||
    lower.includes("expired") ||
    lower.includes("missing or expired")
  ) {
    return "Meta Account Disconnected — Token Expired";
  }
  if (lower.includes("invalid") && lower.includes("token")) {
    return "Meta Account Disconnected — Invalid Token";
  }
  if (lower.includes("oauth") || lower.includes("access token") || text.length > 120) {
    return "Meta Account Disconnected";
  }
  return text;
}

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
