import "server-only";

import { eq } from "drizzle-orm";
import { ensureDb } from "./db";
import { campaignTrackers } from "./db/schema";
import { logActivity } from "./db/seed";
import { env, integrationStatus } from "./env";
import { activateAdSet, pauseAdSet, pauseTikTokAdGroup, resumeTikTokAdGroup } from "./margin-guard";

const SLEEP_START_MINUTES = 1 * 60;
const RESUME_MINUTES = 6 * 60;

export function localMinutesNow(timeZone: string, at = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(at);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0") % 24;
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

export function isGraveyardWindow(timeZone: string, at = new Date()) {
  const minutes = localMinutesNow(timeZone, at);
  return minutes >= SLEEP_START_MINUTES && minutes < RESUME_MINUTES;
}

export async function runDaypartingTick(input?: { enabled?: boolean; timeZone?: string }) {
  const db = await ensureDb();
  const enabled = Boolean(input?.enabled);
  const timeZone = input?.timeZone || "America/Chicago";
  if (!enabled) {
    return { skipped: true as const, reason: "disabled" as const, slept: 0, resumed: 0 };
  }

  const sleep = isGraveyardWindow(timeZone);
  const live = integrationStatus();
  const rows = await db.select().from(campaignTrackers);
  let slept = 0;
  let resumed = 0;

  if (sleep) {
    for (const row of rows) {
      if (row.isPaused) continue;
      let pausedLive = false;
      if (row.platform === "meta" && live.meta) {
        const { resolveMetaToken } = await import("./integrations/meta-token");
        const metaToken = await resolveMetaToken();
        if (metaToken) pausedLive = await pauseAdSet(row.adSetId, metaToken);
      }
      if (row.platform === "tiktok" && live.tiktok && env.tiktokToken) {
        pausedLive = await pauseTikTokAdGroup(row.adSetId, env.tiktokToken);
      }
      await db
        .update(campaignTrackers)
        .set({
          isPaused: true,
          pauseReason: "DAYPARTING_SLEEP",
          pauseSource: "dayparting",
          lastPolledAt: new Date().toISOString(),
        })
        .where(eq(campaignTrackers.id, row.id));
      slept += 1;
      await logActivity(db, {
        kind: "ads",
        message: `Dayparting slept ${row.adSetName ?? row.adSetId}${pausedLive ? " on-network" : " locally"}.`,
        href: "/ads",
      });
    }
    return { skipped: false as const, reason: "sleep" as const, slept, resumed };
  }

  for (const row of rows) {
    if (!row.isPaused || row.pauseSource !== "dayparting") continue;
    let resumedLive = false;
    if (row.platform === "meta" && live.meta) {
      const { resolveMetaToken } = await import("./integrations/meta-token");
      const metaToken = await resolveMetaToken();
      if (metaToken) resumedLive = await activateAdSet(row.adSetId, metaToken);
    }
    if (row.platform === "tiktok" && live.tiktok && env.tiktokToken) {
      resumedLive = await resumeTikTokAdGroup(row.adSetId, env.tiktokToken);
    }
    await db
      .update(campaignTrackers)
      .set({
        isPaused: false,
        pauseReason: null,
        pauseSource: null,
        lastPolledAt: new Date().toISOString(),
      })
      .where(eq(campaignTrackers.id, row.id));
    resumed += 1;
    await logActivity(db, {
      kind: "ads",
      message: `Dayparting resumed ${row.adSetName ?? row.adSetId}${resumedLive ? " on-network" : " locally"}.`,
      href: "/ads",
    });
  }

  return { skipped: false as const, reason: "resume" as const, slept, resumed };
}
