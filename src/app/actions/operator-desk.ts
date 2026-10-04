"use server";

import { revalidatePath } from "next/cache";
import { markDirectiveDone } from "@/lib/operator-desk-run";

export async function completeDailyDirective(id: string) {
  await markDirectiveDone(id, true);
  revalidatePath("/");
  return { ok: true as const };
}

export async function restoreDailyDirective(id: string) {
  await markDirectiveDone(id, false);
  revalidatePath("/");
  return { ok: true as const };
}
