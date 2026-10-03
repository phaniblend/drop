import "server-only";

import { eq } from "drizzle-orm";
import { env } from "../env";
import { ensureDb } from "../db";
import { users } from "../db/schema";
import { metaAdAccounts, metaConnections } from "../db/schema-guard";
import { getOperator } from "../db/queries";
import { encryptSecret } from "../crypto";
import { nid, nowIso } from "../utils";
import { exchangeMetaLongLivedToken } from "../integrations/meta-token";

const GRAPH = "https://graph.facebook.com/v21.0";
const SCOPES = ["ads_read", "ads_management"].join(",");

export function metaOAuthRedirectUri() {
  const base = (env.appUrl || "http://localhost:3000").replace(/\/$/, "");
  return `${base}/api/meta/callback`;
}

export function metaAppReady() {
  return Boolean(env.metaAppId && env.metaAppSecret);
}

export function buildMetaAuthorizeUrl(state: string) {
  if (!env.metaAppId) throw new Error("META_APP_ID is not set.");
  const params = new URLSearchParams({
    client_id: env.metaAppId,
    redirect_uri: metaOAuthRedirectUri(),
    state,
    scope: SCOPES,
    response_type: "code",
  });
  return `https://www.facebook.com/v21.0/dialog/oauth?${params}`;
}

export async function exchangeMetaOAuthCode(code: string) {
  if (!env.metaAppId || !env.metaAppSecret) {
    throw new Error("META_APP_ID and META_APP_SECRET are required.");
  }
  const url = `${GRAPH}/oauth/access_token?${new URLSearchParams({
    client_id: env.metaAppId,
    client_secret: env.metaAppSecret,
    redirect_uri: metaOAuthRedirectUri(),
    code,
  })}`;
  const res = await fetch(url);
  const json = (await res.json()) as { access_token?: string; error?: { message?: string } };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error?.message || `Meta OAuth failed (${res.status}).`);
  }
  return json.access_token;
}

export async function saveMetaConnectionFromToken(shortOrLongToken: string) {
  const operator = await getOperator();
  if (!operator) throw new Error("Sign in first.");

  const exchanged = await exchangeMetaLongLivedToken(shortOrLongToken);
  const token = exchanged.accessToken;
  const meRes = await fetch(`${GRAPH}/me?${new URLSearchParams({ access_token: token, fields: "id,name" })}`);
  const me = (await meRes.json()) as { id?: string; name?: string; error?: { message?: string } };
  if (!meRes.ok || !me.id) throw new Error(me.error?.message || "Could not read Meta user.");

  const accountsRes = await fetch(
    `${GRAPH}/me/adaccounts?${new URLSearchParams({
      access_token: token,
      fields: "id,name,account_status,currency,timezone_name,timezone_offset_hours_utc",
      limit: "50",
    })}`,
  );
  const accountsJson = (await accountsRes.json()) as {
    data?: Array<{
      id?: string;
      name?: string;
      account_status?: number;
      currency?: string;
      timezone_name?: string;
      timezone_offset_hours_utc?: number;
    }>;
  };

  const db = await ensureDb();
  const now = nowIso();
  let enc = token;
  try {
    enc = encryptSecret(token);
  } catch {
    /* ENCRYPTION_KEY optional for desk token; still store plaintext on users */
  }

  await db.update(users).set({ metaAccessToken: token }).where(eq(users.id, operator.id));

  const [existing] = await db
    .select()
    .from(metaConnections)
    .where(eq(metaConnections.storeId, operator.id))
    .limit(1);

  const connId = existing?.id ?? nid("mconn");
  const expiresAt =
    exchanged.expiresIn != null ? new Date(Date.now() + exchanged.expiresIn * 1000).toISOString() : null;

  if (existing) {
    await db
      .update(metaConnections)
      .set({
        metaUserId: me.id,
        accessTokenEnc: enc,
        tokenType: "user_long_lived",
        tokenExpiresAt: expiresAt,
        grantedScopesJson: JSON.stringify(["ads_read", "ads_management"]),
        status: "ACTIVE",
        lastErrorCode: null,
        lastErrorAt: null,
        updatedAt: now,
      })
      .where(eq(metaConnections.id, existing.id));
  } else {
    await db.insert(metaConnections).values({
      id: connId,
      storeId: operator.id,
      metaUserId: me.id,
      accessTokenEnc: enc,
      tokenType: "user_long_lived",
      tokenExpiresAt: expiresAt,
      grantedScopesJson: JSON.stringify(["ads_read", "ads_management"]),
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
    });
  }

  for (const row of accountsJson.data ?? []) {
    if (!row.id) continue;
    const [have] = await db.select().from(metaAdAccounts).where(eq(metaAdAccounts.id, row.id)).limit(1);
    const values = {
      metaConnectionId: connId,
      name: row.name || row.id,
      currency: row.currency || "USD",
      timezoneName: row.timezone_name || "UTC",
      timezoneOffsetHoursUtc: row.timezone_offset_hours_utc ?? 0,
      accountStatus: row.account_status ?? 1,
      updatedAt: now,
    };
    if (have) {
      await db.update(metaAdAccounts).set(values).where(eq(metaAdAccounts.id, row.id));
    } else {
      await db.insert(metaAdAccounts).values({
        id: row.id,
        ...values,
        guardEnabled: false,
        createdAt: now,
      });
    }
  }

  // Default-select first account for Guard if none enabled yet.
  const owned = await db
    .select({ id: metaAdAccounts.id, guardEnabled: metaAdAccounts.guardEnabled })
    .from(metaAdAccounts)
    .where(eq(metaAdAccounts.metaConnectionId, connId));
  if (owned.length && !owned.some((a) => a.guardEnabled)) {
    await db.update(metaAdAccounts).set({ guardEnabled: true }).where(eq(metaAdAccounts.id, owned[0]!.id));
  }

  return {
    userId: me.id,
    userName: me.name || me.id,
    accounts: (accountsJson.data ?? []).length,
    expiresInDays: exchanged.expiresIn != null ? Math.round(exchanged.expiresIn / 86_400) : null,
  };
}
