import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { guardActions, guardStates, metaAdAccounts, metaConnections } from "../db/schema-guard";
import { activateAdSet } from "../margin-guard";
import { decryptSecret } from "../crypto";
import { nid, nowIso } from "../utils";

type Db = Awaited<ReturnType<typeof import("../db").ensureDb>>;

export function newUndoToken() {
  const token = randomBytes(32).toString("hex");
  const hash = createHash("sha256").update(token).digest("hex");
  return { token, hash };
}

export async function undoGuardPause(
  input: { token?: string; actionId?: string; actor: string },
  opts: {
    db: Db;
    getLiveStatus?: (adsetId: string, token: string) => Promise<{ status: string; updatedTime?: string }>;
    resume?: (adsetId: string, token: string) => Promise<boolean>;
  },
) {
  const db = opts.db;
  let action;
  if (input.token) {
    const hash = createHash("sha256").update(input.token).digest("hex");
    [action] = await db.select().from(guardActions).where(eq(guardActions.undoTokenHash, hash)).limit(1);
  } else if (input.actionId) {
    [action] = await db.select().from(guardActions).where(eq(guardActions.id, input.actionId)).limit(1);
  }
  if (!action || action.kind !== "PAUSE" || action.result !== "SUCCEEDED") {
    return { ok: false as const, error: "Undo link is invalid or already used." };
  }
  if (action.undoneByActionId) {
    return { ok: false as const, error: "This pause was already undone." };
  }
  if (action.undoExpiresAtUtc && Date.parse(action.undoExpiresAtUtc) < Date.now()) {
    return { ok: false as const, error: "Undo link expired." };
  }

  const [acct] = await db
    .select()
    .from(metaAdAccounts)
    .where(eq(metaAdAccounts.id, action.adAccountId))
    .limit(1);
  const [conn] = acct
    ? await db.select().from(metaConnections).where(eq(metaConnections.id, acct.metaConnectionId)).limit(1)
    : [];
  if (!conn) return { ok: false as const, error: "Meta connection missing." };
  const token = decryptSecret(conn.accessTokenEnc);

  const getLive =
    opts.getLiveStatus ??
    (async (adsetId: string, accessToken: string) => {
      const res = await fetch(
        `https://graph.facebook.com/v26.0/${adsetId}?${new URLSearchParams({
          access_token: accessToken,
          fields: "status,updated_time",
        })}`,
      );
      if (!res.ok) throw new Error(`Meta status failed (${res.status}).`);
      const json = (await res.json()) as { status: string; updated_time?: string };
      return { status: json.status, updatedTime: json.updated_time };
    });
  const live = await getLive(action.adsetId, token);
  const executedAt = action.executedAtUtc ? Date.parse(action.executedAtUtc) : 0;
  const liveUpdated = live.updatedTime ? Date.parse(live.updatedTime) : 0;
  if (live.status !== "PAUSED" || (liveUpdated && executedAt && liveUpdated > executedAt + 2 * 60_000)) {
    await db
      .update(guardStates)
      .set({ state: "EXTERNALLY_CHANGED", updatedAt: nowIso() })
      .where(eq(guardStates.adsetId, action.adsetId));
    return {
      ok: false as const,
      error: "Changed in Ads Manager since Seto paused it — not modified.",
      state: "EXTERNALLY_CHANGED" as const,
    };
  }

  const resume = opts.resume ?? activateAdSet;
  const ok = await resume(action.adsetId, token);
  if (!ok) return { ok: false as const, error: "Meta would not resume the ad set." };

  const undoId = nid("gact");
  const now = nowIso();
  await db.insert(guardActions).values({
    id: undoId,
    adsetId: action.adsetId,
    adAccountId: action.adAccountId,
    storeId: action.storeId,
    evaluationId: action.evaluationId,
    kind: "UNDO_RESUME",
    actor: input.actor,
    mode: action.mode,
    requestedAtUtc: now,
    executedAtUtc: now,
    priorStatus: "PAUSED",
    result: "SUCCEEDED",
  });
  await db
    .update(guardActions)
    .set({ undoneByActionId: undoId, undoTokenHash: null })
    .where(eq(guardActions.id, action.id));

  const snoozeUntil = new Date(Date.now() + 24 * 3600_000).toISOString();
  await db
    .update(guardStates)
    .set({
      state: "RESUMED_BY_USER",
      snoozedUntilUtc: snoozeUntil,
      updatedAt: now,
    })
    .where(eq(guardStates.adsetId, action.adsetId));

  return { ok: true as const, actionId: undoId };
}
