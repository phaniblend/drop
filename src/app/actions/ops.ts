"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { ensureDb } from "@/lib/db";
import { dailyTasks, products, refunds } from "@/lib/db/schema";
import { reverseImageSearch } from "@/lib/integrations/serp";
import { env } from "@/lib/env";
import { assertLensQuota, incrementLensSearches, isBillingError } from "@/lib/billing";
import { ORGANIC_VIEW_FLOOR, parseOrganicViews } from "@/lib/ad-protection";

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
  if (env.serpApiKey) {
    try {
      await assertLensQuota();
    } catch (error) {
      if (isBillingError(error)) {
        return { matches: [] as const, factoryBest: null, warning: undefined, paywall: error.paywall };
      }
      throw error;
    }
  }
  const result = await reverseImageSearch(imageUrl);
  if (env.serpApiKey && result.mode === "live") {
    await incrementLensSearches();
    revalidatePath("/", "layout");
  }
  return result;
}

export async function saveOrganicViews(productId: string, views: [number, number, number]) {
  const db = await ensureDb();
  const normalized = views.map((n) => Math.max(0, Math.round(Number(n) || 0))) as [number, number, number];
  const passed = normalized.every((n) => n >= ORGANIC_VIEW_FLOOR);
  const [row] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
  const status = row?.organicStatus === "overridden" ? "overridden" : passed ? "passed" : "pending";
  await db
    .update(products)
    .set({
      organicViewsJson: JSON.stringify(normalized),
      organicStatus: status,
    })
    .where(eq(products.id, productId));
  revalidatePath("/ops");
  revalidatePath("/");
  revalidatePath("/ads");
  revalidatePath(`/catalog/${productId}`);
  return { views: normalized, status };
}

export async function overrideOrganicUnlock(productId: string) {
  const db = await ensureDb();
  const [row] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
  const views = parseOrganicViews(row?.organicViewsJson);
  await db
    .update(products)
    .set({ organicStatus: "overridden", organicViewsJson: JSON.stringify(views) })
    .where(eq(products.id, productId));
  revalidatePath("/ops");
  revalidatePath("/");
  revalidatePath("/ads");
  revalidatePath(`/catalog/${productId}`);
  return { ok: true as const };
}
