"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { ensureDb } from "@/lib/db";
import { dailyTasks, refunds } from "@/lib/db/schema";
import { reverseImageSearch } from "@/lib/integrations/serp";

export async function toggleTask(id: string, done: boolean) {
  const db = await ensureDb();
  await db.update(dailyTasks).set({ done }).where(eq(dailyTasks.id, id));
  revalidatePath("/ops");
  revalidatePath("/");
}

export async function resolveRefund(id: string, status: "resolved" | "open") {
  const db = await ensureDb();
  await db.update(refunds).set({ status }).where(eq(refunds.id, id));
  revalidatePath("/ops");
  revalidatePath("/");
}

export async function visualSearch(imageUrl: string) {
  return reverseImageSearch(imageUrl);
}
