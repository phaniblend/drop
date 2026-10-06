import "server-only";

import { eq } from "drizzle-orm";
import { ensureDb } from "./db";
import { profinderContacted } from "./db/schema";

export async function listProfinderContacted() {
  const db = await ensureDb();
  const rows = await db.select().from(profinderContacted);
  return {
    ids: new Set(rows.map((r) => r.leadId)),
    handles: new Set(rows.map((r) => r.handle.toLowerCase())),
  };
}

export async function markProfinderContacted(input: {
  leadId: string;
  handle: string;
  sourceUrl?: string;
  byEmail: string;
}) {
  const db = await ensureDb();
  const leadId = input.leadId.trim();
  const handle = input.handle.trim();
  if (!leadId || !handle) return false;
  await db
    .insert(profinderContacted)
    .values({
      leadId,
      handle,
      sourceUrl: input.sourceUrl?.trim() || "",
      byEmail: input.byEmail.trim().toLowerCase(),
      createdAt: new Date().toISOString(),
    })
    .onConflictDoNothing();
  return true;
}

export async function isHandleContacted(handle: string) {
  const db = await ensureDb();
  const [row] = await db
    .select({ leadId: profinderContacted.leadId })
    .from(profinderContacted)
    .where(eq(profinderContacted.handle, handle.trim()))
    .limit(1);
  return Boolean(row);
}
