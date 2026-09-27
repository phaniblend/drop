import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { ensureDb } from "./db";
import { savedListings } from "./db/schema";
import { requireOperator } from "./db/queries";
import { asFeedProduct, savedListingKey } from "./saved-listing";
import type { FeedProduct } from "./supplier-feed";
import { nid, nowIso } from "./utils";

const MAX_SAVED = 80;

export async function listSavedFeedProducts(): Promise<FeedProduct[]> {
  const user = await requireOperator();
  const db = await ensureDb();
  const rows = await db
    .select()
    .from(savedListings)
    .where(eq(savedListings.userId, user.id))
    .orderBy(desc(savedListings.createdAt));
  return rows
    .map((row) => {
      try {
        return asFeedProduct(JSON.parse(row.snapshotJson));
      } catch {
        return null;
      }
    })
    .filter((item): item is FeedProduct => Boolean(item));
}

export async function toggleSavedListing(item: FeedProduct): Promise<{
  saved: boolean;
  keys: string[];
  items: FeedProduct[];
}> {
  const user = await requireOperator();
  const db = await ensureDb();
  const key = savedListingKey(item);
  const [existing] = await db
    .select()
    .from(savedListings)
    .where(and(eq(savedListings.userId, user.id), eq(savedListings.listingKey, key)))
    .limit(1);
  if (existing) {
    await db.delete(savedListings).where(eq(savedListings.id, existing.id));
  } else {
    const current = await db.select({ id: savedListings.id }).from(savedListings).where(eq(savedListings.userId, user.id));
    if (current.length >= MAX_SAVED) {
      throw new Error(`You can save ${MAX_SAVED} listings. Remove one first.`);
    }
    await db.insert(savedListings).values({
      id: nid("sav"),
      userId: user.id,
      listingKey: key,
      snapshotJson: JSON.stringify(item),
      createdAt: nowIso(),
    });
  }
  const items = await listSavedFeedProducts();
  return { saved: !existing, keys: items.map(savedListingKey), items };
}
