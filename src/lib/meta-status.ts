export type MetaHealthStatus = "connected" | "degraded" | "offline";

/** One label set for Command, Settings, Ads, and go-live. */
export function metaStatusLabel(status: MetaHealthStatus): {
  short: string;
  badge: "CONNECTED" | "NEEDS SETUP" | "OFFLINE";
  detail: string;
} {
  if (status === "connected") {
    return {
      short: "Ready",
      badge: "CONNECTED",
      detail: "Meta is connected — Margin Guard can read spend and pause ad sets you allow.",
    };
  }
  if (status === "degraded") {
    return {
      short: "Needs setup",
      badge: "NEEDS SETUP",
      detail: "Meta Login started but Guard is not fully ready — reconnect with Facebook in Settings.",
    };
  }
  return {
    short: "Pending",
    badge: "OFFLINE",
    detail: "Connect with Facebook in Settings so Margin Guard can protect spend.",
  };
}

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
