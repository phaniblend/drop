import "server-only";

import { eq } from "drizzle-orm";
import { env } from "./env";
import { ensureDb } from "./db";
import { settings } from "./db/schema";
import { classifyMetaStatus, type MetaHealthStatus } from "./meta-status";

export type { MetaHealthStatus };
export { classifyMetaStatus };

const SETTINGS_KEY = "meta_health";
const STALE_MS = 60 * 60 * 1000;
const META_API_VERSION = "v26.0";

export type MetaHealth = {
  status: MetaHealthStatus;
  /** True only when a live ad-account call succeeds. */
  live: boolean;
  configured: boolean;
  degraded: boolean;
  error: string | null;
  accountId: string;
  checkedAt: string | null;
  longLived: boolean;
};

type Stored = {
  status: MetaHealthStatus;
  live: boolean;
  error: string | null;
  accountId: string;
  checkedAt: string;
  longLived: boolean;
};

function normalizeAdAccountId(raw: string) {
  const id = raw.trim();
  if (!id) return "";
  return id.startsWith("act_") ? id : `act_${id}`;
}

function offline(error: string): MetaHealth {
  return {
    status: "offline",
    live: false,
    configured: false,
    degraded: false,
    error,
    accountId: "",
    checkedAt: null,
    longLived: false,
  };
}

async function readStored(): Promise<Stored | null> {
  try {
    const db = await ensureDb();
    const [row] = await db.select().from(settings).where(eq(settings.key, SETTINGS_KEY)).limit(1);
    if (!row?.value) return null;
    return JSON.parse(row.value) as Stored;
  } catch {
    return null;
  }
}

async function writeStored(value: Stored) {
  const db = await ensureDb();
  await db
    .insert(settings)
    .values({ key: SETTINGS_KEY, value: JSON.stringify(value) })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: JSON.stringify(value) },
    });
}

async function resolveTokenAndLongLived(): Promise<{ token: string; longLived: boolean }> {
  const { resolveMetaToken, hasDeskMetaToken } = await import("./integrations/meta-token");
  const token = await resolveMetaToken();
  const longLived = await hasDeskMetaToken();
  return { token, longLived };
}

/** Live ping against act_{id}; cached ~1h unless force. */
export async function pingMeta(force = false): Promise<MetaHealth> {
  const envToken = Boolean(env.metaToken);
  let deskToken = false;
  try {
    const { hasDeskMetaToken } = await import("./integrations/meta-token");
    deskToken = await hasDeskMetaToken();
  } catch {
    deskToken = false;
  }
  const configured = envToken || deskToken;
  if (!configured) {
    return offline("META_ACCESS_TOKEN is not set");
  }

  const cached = await readStored();
  if (!force && cached?.checkedAt && Date.now() - Date.parse(cached.checkedAt) < STALE_MS) {
    return {
      status: cached.status,
      live: cached.live,
      configured: true,
      degraded: cached.status === "degraded",
      error: cached.error,
      accountId: cached.accountId,
      checkedAt: cached.checkedAt,
      longLived: cached.longLived,
    };
  }

  const accountId = normalizeAdAccountId(env.metaAdAccountId);
  const { token, longLived } = await resolveTokenAndLongLived();

  if (!accountId) {
    const stored: Stored = {
      status: "degraded",
      live: false,
      error: "META_AD_ACCOUNT_ID is missing. Add act_… on Railway.",
      accountId: "",
      checkedAt: new Date().toISOString(),
      longLived,
    };
    try {
      await writeStored(stored);
    } catch {
      /* ignore */
    }
    return {
      status: "degraded",
      live: false,
      configured: true,
      degraded: true,
      error: stored.error,
      accountId: "",
      checkedAt: stored.checkedAt,
      longLived,
    };
  }

  if (!token) {
    const stored: Stored = {
      status: "degraded",
      live: false,
      error: "Meta token missing or expired.",
      accountId,
      checkedAt: new Date().toISOString(),
      longLived: false,
    };
    try {
      await writeStored(stored);
    } catch {
      /* ignore */
    }
    return {
      status: "degraded",
      live: false,
      configured: true,
      degraded: true,
      error: stored.error,
      accountId,
      checkedAt: stored.checkedAt,
      longLived: false,
    };
  }

  const url = `https://graph.facebook.com/${META_API_VERSION}/${accountId}?${new URLSearchParams({
    access_token: token,
    fields: "id,name,account_status",
  })}`;

  let error: string | null = null;
  let live = false;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    const raw = await res.text();
    let json: { id?: string; error?: { message?: string; code?: number } } = {};
    try {
      json = JSON.parse(raw) as typeof json;
    } catch {
      error = `Meta HTTP ${res.status}: non-JSON body`;
    }
    if (!error) {
      if (!res.ok || json.error) {
        error = json.error?.message || `Meta HTTP ${res.status}`;
      } else if (json.id) {
        live = true;
      } else {
        error = "Meta returned no ad account id.";
      }
    }
  } catch (e) {
    error = e instanceof Error ? e.message : "Meta network error";
  }

  // Token works but is short-lived and cannot be extended → still degraded for Guard longevity.
  let status: MetaHealthStatus = live ? "connected" : "degraded";
  if (live && !longLived && !(env.metaAppId && env.metaAppSecret)) {
    status = "degraded";
    error =
      error ||
      "Token works but is short-lived — add META_APP_ID + META_APP_SECRET and Extend in Settings.";
  } else if (live && !longLived) {
    // Can extend — count as connected for live APIs, still surface tip in Settings.
    status = "connected";
  }

  const stored: Stored = {
    status,
    live: status === "connected",
    error: status === "connected" ? null : error,
    accountId,
    checkedAt: new Date().toISOString(),
    longLived,
  };
  try {
    await writeStored(stored);
  } catch {
    /* ignore */
  }

  return {
    status: stored.status,
    live: stored.live,
    configured: true,
    degraded: stored.status === "degraded",
    error: stored.error,
    accountId: stored.accountId,
    checkedAt: stored.checkedAt,
    longLived: stored.longLived,
  };
}

export async function getMetaHealth(force = false): Promise<MetaHealth> {
  return pingMeta(force);
}
