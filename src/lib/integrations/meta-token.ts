import "server-only";

import { eq } from "drizzle-orm";
import { env } from "../env";
import { ensureDb } from "../db";
import { users } from "../db/schema";
import { getOperator } from "../db/queries";

const GRAPH = "https://graph.facebook.com/v21.0";

/**
 * Prefer operator DB token (long-lived after exchange) over Railway env short-lived.
 */
export async function resolveMetaToken(): Promise<string> {
  const operator = await getOperator();
  const fromDb = operator?.metaAccessToken?.trim();
  if (fromDb) return fromDb;
  return env.metaToken;
}

export async function exchangeMetaLongLivedToken(shortLived?: string): Promise<{
  accessToken: string;
  expiresIn: number | null;
  saved: boolean;
}> {
  const appId = env.metaAppId;
  const appSecret = env.metaAppSecret;
  if (!appId || !appSecret) {
    throw new Error(
      "Add META_APP_ID and META_APP_SECRET on Railway (App settings → Basic), then run Extend Meta token.",
    );
  }

  const input = (shortLived || env.metaToken || "").trim();
  if (!input) {
    throw new Error("No META_ACCESS_TOKEN to exchange. Paste a fresh Graph Explorer token on Railway first.");
  }

  const url = `${GRAPH}/oauth/access_token?${new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: input,
  })}`;

  const res = await fetch(url);
  const text = await res.text();
  let json: { access_token?: string; expires_in?: number; error?: { message?: string } };
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    throw new Error(`Meta token exchange failed: ${text.slice(0, 200)}`);
  }
  if (!res.ok || !json.access_token) {
    throw new Error(json.error?.message || `Meta token exchange failed (${res.status}).`);
  }

  const operator = await getOperator();
  let saved = false;
  if (operator) {
    const db = await ensureDb();
    await db
      .update(users)
      .set({ metaAccessToken: json.access_token })
      .where(eq(users.id, operator.id));
    saved = true;
  }

  return {
    accessToken: json.access_token,
    expiresIn: typeof json.expires_in === "number" ? json.expires_in : null,
    saved,
  };
}
