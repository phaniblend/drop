import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { ensureDb } from "@/lib/db";
import { complianceRequests, metaConnections } from "@/lib/db/schema-guard";
import { users } from "@/lib/db/schema";
import { nid, nowIso } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Meta App Review data-deletion callback.
 * Meta POSTs signed_request; we acknowledge and scrub stored Meta tokens for that user id.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const signed = form?.get("signed_request");
  const confirmationCode = nid("del").replace("del_", "").slice(0, 12);
  const now = nowIso();

  let metaUserId = "";
  if (typeof signed === "string" && signed.includes(".")) {
    try {
      const [, payload] = signed.split(".");
      const json = JSON.parse(Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")) as {
        user_id?: string;
      };
      metaUserId = json.user_id || "";
    } catch {
      /* still acknowledge */
    }
  }

  const db = await ensureDb();
  await db.insert(complianceRequests).values({
    id: nid("cmp"),
    topic: "meta/data_deletion",
    shopDomain: metaUserId || "meta",
    shopifyCustomerId: metaUserId || null,
    ordersRequestedJson: "[]",
    payloadJson: JSON.stringify({ confirmationCode, receivedAt: now }),
    receivedAtUtc: now,
    dueByUtc: new Date(Date.now() + 30 * 24 * 3600_000).toISOString(),
    completedAtUtc: now,
  });

  if (metaUserId) {
    const [conn] = await db
      .select()
      .from(metaConnections)
      .where(eq(metaConnections.metaUserId, metaUserId))
      .limit(1);
    if (conn) {
      await db
        .update(metaConnections)
        .set({
          accessTokenEnc: createHash("sha256").update("redacted").digest("hex"),
          status: "REVOKED",
          updatedAt: now,
        })
        .where(eq(metaConnections.id, conn.id));
      await db.update(users).set({ metaAccessToken: null }).where(eq(users.id, conn.storeId));
    }
  }

  const statusUrl = `${(process.env.APP_URL || "https://www.seto.store").replace(/\/$/, "")}/privacy`;
  return NextResponse.json({
    url: statusUrl,
    confirmation_code: confirmationCode,
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Meta data deletion callback. POST signed_request from Facebook.",
  });
}
