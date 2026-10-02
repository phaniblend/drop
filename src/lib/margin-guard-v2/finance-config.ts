import "server-only";

import { eq } from "drizzle-orm";
import { storeFinanceConfigs } from "../db/schema-guard";
import { requireOperator } from "../db/queries";
import { ensureDb } from "../db";
import { nowIso } from "../utils";

export type GuardMode = "OFF" | "ALERT_ONLY" | "AUTO_PAUSE";

export async function getOrCreateFinanceConfig(storeId: string) {
  const db = await ensureDb();
  const [row] = await db
    .select()
    .from(storeFinanceConfigs)
    .where(eq(storeFinanceConfigs.storeId, storeId))
    .limit(1);
  if (row) return row;
  const updatedAt = nowIso();
  await db.insert(storeFinanceConfigs).values({
    storeId,
    updatedAt,
  });
  const [created] = await db
    .select()
    .from(storeFinanceConfigs)
    .where(eq(storeFinanceConfigs.storeId, storeId))
    .limit(1);
  return created!;
}

export function autoPauseGloballyEnabled() {
  return process.env.MARGIN_GUARD_AUTOPAUSE_ENABLED !== "false";
}

export async function saveGuardMode(input: {
  mode: GuardMode;
  consentAutoPause?: boolean;
}) {
  const operator = await requireOperator();
  const db = await ensureDb();
  const existing = await getOrCreateFinanceConfig(operator.id);
  const now = nowIso();
  let mode = input.mode;
  if (mode === "AUTO_PAUSE") {
    if (!autoPauseGloballyEnabled()) {
      throw new Error("Auto-pause is disabled on this host (MARGIN_GUARD_AUTOPAUSE_ENABLED=false).");
    }
    if (!input.consentAutoPause && !existing.autoPauseConsentAt) {
      throw new Error("Confirm that Seto may pause ad sets before enabling AUTO_PAUSE.");
    }
  }
  await db
    .update(storeFinanceConfigs)
    .set({
      guardMode: mode,
      autoPauseConsentAt:
        mode === "AUTO_PAUSE"
          ? existing.autoPauseConsentAt || now
          : existing.autoPauseConsentAt,
      autoPauseConsentBy:
        mode === "AUTO_PAUSE"
          ? existing.autoPauseConsentBy || operator.email
          : existing.autoPauseConsentBy,
      updatedAt: now,
    })
    .where(eq(storeFinanceConfigs.storeId, operator.id));
  return getOrCreateFinanceConfig(operator.id);
}

export async function canAutoPause(storeId: string) {
  if (!autoPauseGloballyEnabled()) return { ok: false, reason: "GLOBAL_KILL_SWITCH" as const };
  const cfg = await getOrCreateFinanceConfig(storeId);
  if (cfg.guardMode !== "AUTO_PAUSE") return { ok: false, reason: "ALERT_ONLY" as const };
  if (!cfg.autoPauseConsentAt) return { ok: false, reason: "NO_CONSENT" as const };
  return { ok: true as const, maxPerDay: cfg.maxAutoPausesPerDay };
}
