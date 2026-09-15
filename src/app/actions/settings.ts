"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { ensureDb, resetReadyCache } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { DEMO_USER_ID, resetDemo } from "@/lib/db/seed";

export async function saveOperatorSettings(input: {
  displayName: string;
  storeName: string;
  email: string;
  markupMultiplier: number;
  spendLimitThreshold: number;
  minRoasThreshold: number;
}) {
  const db = await ensureDb();
  await db
    .update(users)
    .set({
      displayName: input.displayName,
      storeName: input.storeName,
      email: input.email,
      markupMultiplier: input.markupMultiplier,
      spendLimitThreshold: input.spendLimitThreshold,
      minRoasThreshold: input.minRoasThreshold,
    })
    .where(eq(users.id, DEMO_USER_ID));
  revalidatePath("/settings");
  revalidatePath("/");
}

export async function resetDemoData() {
  const db = await ensureDb();
  await resetDemo(db);
  resetReadyCache();
  revalidatePath("/", "layout");
}
