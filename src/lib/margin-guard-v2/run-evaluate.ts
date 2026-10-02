import "server-only";

import { desc, eq } from "drizzle-orm";
import {
  adPerformanceSnapshots,
  adAttributions,
  guardEvaluations,
  guardStates,
  shopifyOrders,
  shopifyConnections,
  metaAdAccounts,
  metaConnections,
  guardActions,
} from "../db/schema-guard";
import { ensureDb } from "../db";
import { evaluateDualSignal, FORMULA_VERSION } from "./evaluate";
import { canAutoPause, getOrCreateFinanceConfig } from "./finance-config";
import { reconcileIsStale } from "../shopify/reconcile";
import { nid, nowIso } from "../utils";
import { pauseAdSet } from "../margin-guard";
import { resolveMetaToken } from "../integrations/meta-token";
import { newUndoToken } from "./undo";

export async function listRecentEvaluations(adsetId: string, limit = 5) {
  const db = await ensureDb();
  return db
    .select()
    .from(guardEvaluations)
    .where(eq(guardEvaluations.adsetId, adsetId))
    .orderBy(desc(guardEvaluations.evaluatedAtUtc))
    .limit(limit);
}

export async function listLatestEvaluationsForAdsets(adsetIds: string[]) {
  const out: Record<
    string,
    {
      verdict: string;
      reasonCodes: string[];
      formulaVersion: string;
      evaluatedAtUtc: string;
      inputs: Record<string, number | null>;
    }
  > = {};
  for (const id of adsetIds) {
    if (!id || out[id]) continue;
    const rows = await listRecentEvaluations(id, 1);
    const row = rows[0];
    if (!row) continue;
    let reasonCodes: string[] = [];
    let inputs: Record<string, number | null> = {};
    try {
      reasonCodes = JSON.parse(row.reasonCodesJson || "[]") as string[];
    } catch {
      reasonCodes = [];
    }
    try {
      inputs = JSON.parse(row.inputsJson || "{}") as Record<string, number | null>;
    } catch {
      inputs = {};
    }
    out[id] = {
      verdict: row.verdict,
      reasonCodes,
      formulaVersion: row.formulaVersion,
      evaluatedAtUtc: row.evaluatedAtUtc,
      inputs,
    };
  }
  return out;
}

/** Run dual-signal evaluate for every ACTIVE ad set we know about. */
export async function evaluateAllActiveAdSets() {
  const db = await ensureDb();
  const states = await db.select().from(guardStates);
  const accounts = await db
    .select({
      id: metaAdAccounts.id,
      storeId: metaConnections.storeId,
    })
    .from(metaAdAccounts)
    .innerJoin(metaConnections, eq(metaAdAccounts.metaConnectionId, metaConnections.id));

  const accountStore = new Map(accounts.map((a) => [a.id, a.storeId]));
  const snapshots = await db
    .select()
    .from(adPerformanceSnapshots)
    .orderBy(desc(adPerformanceSnapshots.snapshotAtUtc))
    .limit(200);

  const seen = new Set<string>();
  const jobs: Array<{ storeId: string; adAccountId: string; adsetId: string }> = [];

  for (const s of states) {
    if (s.exempt || s.state === "PAUSED_BY_SETO") continue;
    if (seen.has(s.adsetId)) continue;
    seen.add(s.adsetId);
    jobs.push({ storeId: s.storeId, adAccountId: s.adAccountId, adsetId: s.adsetId });
  }
  for (const snap of snapshots) {
    if (snap.level !== "ADSET") continue;
    if (seen.has(snap.entityId)) continue;
    const storeId = accountStore.get(snap.adAccountId);
    if (!storeId) continue;
    seen.add(snap.entityId);
    jobs.push({
      storeId,
      adAccountId: snap.adAccountId,
      adsetId: snap.entityId,
    });
  }

  const results: Array<{ adsetId: string; verdict: string; paused: boolean; error?: string }> = [];
  for (const job of jobs.slice(0, 80)) {
    try {
      const r = await evaluateAdSetDualSignal(job);
      results.push({ adsetId: job.adsetId, verdict: r.verdict, paused: r.paused });
    } catch (e) {
      results.push({
        adsetId: job.adsetId,
        verdict: "ERROR",
        paused: false,
        error: e instanceof Error ? e.message : "evaluate failed",
      });
    }
  }
  return results;
}

export async function evaluateAdSetDualSignal(input: {
  storeId: string;
  adAccountId: string;
  adsetId: string;
}) {
  const db = await ensureDb();
  const finance = await getOrCreateFinanceConfig(input.storeId);
  const [snap] = await db
    .select()
    .from(adPerformanceSnapshots)
    .where(eq(adPerformanceSnapshots.entityId, input.adsetId))
    .orderBy(desc(adPerformanceSnapshots.snapshotAtUtc))
    .limit(1);

  const [conn] = await db
    .select()
    .from(shopifyConnections)
    .where(eq(shopifyConnections.storeId, input.storeId))
    .limit(1);

  const attributions = await db
    .select()
    .from(adAttributions)
    .where(eq(adAttributions.adsetId, input.adsetId));
  const orderIds = attributions
    .filter((a) => a.model === "UTM_LAST_VISIT" && (a.confidence === "EXACT_ID" || a.confidence === "ID_FROM_NAME_LOOKUP"))
    .map((a) => a.orderId);

  let nShop = 0;
  let cmShop = 0;
  for (const id of orderIds) {
    const [order] = await db.select().from(shopifyOrders).where(eq(shopifyOrders.id, id)).limit(1);
    if (!order || order.test || order.cancelledAtUtc) continue;
    nShop += 1;
    cmShop += order.contributionMargin;
  }

  const [state] = await db.select().from(guardStates).where(eq(guardStates.adsetId, input.adsetId)).limit(1);
  const insightsAgeMin = snap ? (Date.now() - Date.parse(snap.snapshotAtUtc)) / 60_000 : 999;
  const shopifyAgeMin = conn?.lastReconciledAt
    ? (Date.now() - Date.parse(conn.lastReconciledAt)) / 60_000
    : 999;

  const beCpa =
    nShop >= 1 && cmShop !== 0
      ? cmShop / nShop
      : finance.defaultCogsPctOfPrice != null
        ? null
        : null;

  const result = evaluateDualSignal({
    spend: snap?.spend ?? 0,
    nMeta: snap?.purchases ?? 0,
    rMeta: snap?.purchaseValue ?? 0,
    nShop,
    cmShop,
    beCpa: beCpa ?? 17.9,
    marginRatio: 0.41,
    breakEvenMultiplier: finance.breakEvenMultiplier,
    minSpendFloor: finance.minSpendFloor,
    lossTolerancePct: finance.lossTolerancePct,
    consecutiveHits: (state?.consecutiveHits ?? 0) + 1,
    consecutiveHitsRequired: finance.consecutiveHitsRequired,
    hoursSinceFloor: state?.floorCrossedAtUtc
      ? (Date.now() - Date.parse(state.floorCrossedAtUtc)) / 3600_000
      : snap && snap.spend >= finance.minSpendFloor
        ? 0
        : null,
    attributionLagHours: finance.attributionLagHours,
    insightsAgeMin,
    shopifyAgeMin: reconcileIsStale(conn?.lastReconciledAt) ? shopifyAgeMin : Math.min(shopifyAgeMin, 30),
    metaTokenOk: true,
    adsetActive: true,
    exempt: Boolean(state?.exempt),
    snoozed: Boolean(state?.snoozedUntilUtc && Date.parse(state.snoozedUntilUtc) > Date.now()),
  });

  const evalId = nid("geval");
  const now = nowIso();
  await db.insert(guardEvaluations).values({
    id: evalId,
    adsetId: input.adsetId,
    evaluatedAtUtc: now,
    formulaVersion: FORMULA_VERSION,
    inputsJson: JSON.stringify(result.inputs),
    verdict: result.verdict,
    reasonCodesJson: JSON.stringify(result.reasonCodes),
  });

  const isCandidate =
    result.verdict === "CANDIDATE_NO_SALE" || result.verdict === "CANDIDATE_NEGATIVE_NET";
  const nextHits = isCandidate || result.verdict === "HOLD_LAG" ? (state?.consecutiveHits ?? 0) + 1 : 0;
  const nextState =
    result.verdict === "BLOCKED_DATA"
      ? "BLOCKED"
      : result.verdict === "HOLD_LAG" || isCandidate
        ? "CANDIDATE"
        : result.verdict === "HOLD_DISAGREE"
          ? "ALERTED"
          : "MONITORING";

  if (state) {
    await db
      .update(guardStates)
      .set({
        state: nextState,
        consecutiveHits: nextHits,
        candidateSinceUtc: nextState === "CANDIDATE" ? state.candidateSinceUtc || now : null,
        floorCrossedAtUtc:
          result.inputs.S >= result.inputs.F ? state.floorCrossedAtUtc || now : state.floorCrossedAtUtc,
        lastEvaluationId: evalId,
        updatedAt: now,
      })
      .where(eq(guardStates.adsetId, input.adsetId));
  } else {
    await db.insert(guardStates).values({
      adsetId: input.adsetId,
      adAccountId: input.adAccountId,
      storeId: input.storeId,
      state: nextState,
      consecutiveHits: nextHits,
      candidateSinceUtc: nextState === "CANDIDATE" ? now : null,
      floorCrossedAtUtc: result.inputs.S >= result.inputs.F ? now : null,
      lastEvaluationId: evalId,
      updatedAt: now,
    });
  }

  let paused = false;
  if (isCandidate && result.verdict !== "HOLD_LAG") {
    const gate = await canAutoPause(input.storeId);
    if (gate.ok) {
      const token = await resolveMetaToken();
      if (token) {
        const actionId = nid("gact");
        const undo = newUndoToken();
        await db.insert(guardActions).values({
          id: actionId,
          adsetId: input.adsetId,
          adAccountId: input.adAccountId,
          storeId: input.storeId,
          evaluationId: evalId,
          kind: "PAUSE",
          actor: "system",
          mode: "AUTO_PAUSE",
          requestedAtUtc: now,
          priorStatus: "ACTIVE",
          result: "PENDING",
          undoTokenHash: undo.hash,
          undoExpiresAtUtc: new Date(Date.now() + 72 * 3600_000).toISOString(),
        });
        try {
          const ok = await pauseAdSet(input.adsetId, token);
          await db
            .update(guardActions)
            .set({
              result: ok ? "SUCCEEDED" : "FAILED",
              executedAtUtc: nowIso(),
              metaResponseJson: JSON.stringify({ success: ok }),
            })
            .where(eq(guardActions.id, actionId));
          if (ok) {
            paused = true;
            await db
              .update(guardStates)
              .set({ state: "PAUSED_BY_SETO", updatedAt: nowIso() })
              .where(eq(guardStates.adsetId, input.adsetId));
          }
        } catch (e) {
          await db
            .update(guardActions)
            .set({
              result: "FAILED",
              executedAtUtc: nowIso(),
              metaResponseJson: JSON.stringify({
                error: e instanceof Error ? e.message : "pause failed",
              }),
            })
            .where(eq(guardActions.id, actionId));
        }
      }
    } else {
      await db.insert(guardActions).values({
        id: nid("gact"),
        adsetId: input.adsetId,
        adAccountId: input.adAccountId,
        storeId: input.storeId,
        evaluationId: evalId,
        kind: "ALERT",
        actor: "system",
        mode: finance.guardMode,
        requestedAtUtc: now,
        result: gate.reason === "ALERT_ONLY" ? "SUCCEEDED" : "SKIPPED_CAP",
      });
    }
  }

  return { ...result, evaluationId: evalId, paused };
}
