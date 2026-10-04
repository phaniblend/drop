"use server";

import { revalidatePath } from "next/cache";
import {
  confirmCoachStep,
  getOrCreateCoachSession,
  importCoachPick,
  restartCoachToday,
  submitCoachPick,
} from "@/lib/coach-run";
import type { CoachPick } from "@/lib/coach-plan";

function bust() {
  revalidatePath("/", "layout");
}

export async function loadCoachSession() {
  try {
    return await getOrCreateCoachSession();
  } catch {
    return null;
  }
}

export async function shareListingWithCoach(pick: CoachPick) {
  const session = await submitCoachPick(pick);
  bust();
  return session;
}

export async function importSharedListing() {
  const result = await importCoachPick();
  bust();
  return result;
}

export async function markCoachStepDone() {
  const result = await confirmCoachStep();
  bust();
  return result;
}

export async function resetCoachToday() {
  const session = await restartCoachToday();
  bust();
  return session;
}
