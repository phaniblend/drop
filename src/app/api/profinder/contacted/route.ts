import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canOpenProfinder } from "@/lib/profinder-allow";
import { markProfinderContacted } from "@/lib/profinder-contacted";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!canOpenProfinder(email)) {
    return NextResponse.json({ error: "Not available." }, { status: 404 });
  }
  const body = (await req.json()) as { id?: string; handle?: string; sourceUrl?: string };
  const ok = await markProfinderContacted({
    leadId: body.id || "",
    handle: body.handle || "",
    sourceUrl: body.sourceUrl,
    byEmail: email!,
  });
  if (!ok) return NextResponse.json({ error: "Missing lead." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
