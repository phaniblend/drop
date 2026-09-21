"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { ensureDb, resetReadyCache } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { clearWorkspaceKeepOperator } from "@/lib/db/seed";
import { requireOperator } from "@/lib/db/queries";

export async function saveOperatorSettings(input: {
  displayName: string;
  storeName: string;
  email: string;
  markupMultiplier: number;
  spendLimitThreshold: number;
  minRoasThreshold: number;
  timezone?: string;
  daypartingEnabled?: boolean;
}) {
  const operator = await requireOperator();
  const db = await ensureDb();
  await db
    .update(users)
    .set({
      displayName: input.displayName,
      storeName: input.storeName,
      markupMultiplier: input.markupMultiplier,
      spendLimitThreshold: input.spendLimitThreshold,
      minRoasThreshold: input.minRoasThreshold,
      timezone: input.timezone?.trim() || "America/Chicago",
      daypartingEnabled: Boolean(input.daypartingEnabled),
    })
    .where(eq(users.id, operator.id));
  revalidatePath("/settings");
  revalidatePath("/ads");
  revalidatePath("/");
}

export async function resetDemoData() {
  const db = await ensureDb();
  await clearWorkspaceKeepOperator(db);
  resetReadyCache();
  revalidatePath("/", "layout");
}

export async function repairCatalog() {
  const db = await ensureDb();
  const { repairCatalogData } = await import("@/lib/db/repair-catalog");
  const result = await repairCatalogData(db);
  resetReadyCache();
  revalidatePath("/", "layout");
  return result;
}
